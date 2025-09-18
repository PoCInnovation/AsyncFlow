import { createHash } from "crypto";
import { sleep } from "./utils/lambda";
import { lambdaClient } from "./awsClients";
import { getUsedEnvVariables } from "./utils/environment";
import { getCodePolicies, createLambdaRole } from "./utils/roles";
import { languageConfig } from "./utils/language";
import {
  GetFunctionCommand,
  InvokeCommand,
} from "@aws-sdk/client-lambda";
import { bundleCode } from "./utils/codeParser";
import { resolve, dirname } from "path";
import { getCallerFile } from "./utils/codeParser";
import { rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";
import { sendToLambda } from "./sendLambda";
import { initDirectories, initCallbacks } from "./initialize";

type JSONPrimitive = string | number | boolean | null;

type JSONArray = JSONPrimitive[];

type JSONObject = {
  readonly [key: string | number]: Serializable;
};

export type Serializable = JSONPrimitive | JSONArray | JSONObject;

type SerializableFunction<F> = F &
  (F extends (...args: infer A) => infer R
    ? A extends readonly Serializable[]
      ? R extends Promise<Serializable>
        ? unknown
        : "❌ Function return type isn't serializable."
      : "❌ Function arguments are not serializable."
    : never);

export async function resourceAvailable(
  hash: string,
  maxAttempts = 30,
  delayMs = 500,
) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await lambdaClient.send(
        new GetFunctionCommand({ FunctionName: hash }),
      );
      if (res.Configuration?.State === "Active") {
        return res.Configuration;
      }
    } catch (err) {
      if ((err as any).name !== "ResourceNotFoundException") throw err;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Lambda "${hash}" never became ready`);
}

function isAsync(fn: unknown): fn is (...args: any[]) => Promise<any> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return typeof fn === "function" && fn instanceof AsyncFunction;
}


function injectCode<F extends (...args: any[]) => any>(
  fun: SerializableFunction<F>,
){
  let respString = 'const response = fn()'
  if (isAsync(fun)){
    respString = 'const response = await fn() '
  }

  return `
  export const handler = async (event) => {
  const fn = ${fun.toString()}

  ${respString}
  // TODO implement
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};`
}

export class Asyncflow {
  private constructor() {}

  static async init(
    initializeDirectories: boolean = true,
    initializeCallbacks: boolean = true,) {

    const asyncflowInstance = new Asyncflow();
    if (initializeDirectories){
      await initDirectories()
    }
    if (initializeCallbacks){
      await initCallbacks()
    }
    return asyncflowInstance
  }

  async addJob<F extends (...args: any[]) => any>(
    fun: SerializableFunction<F>,
  ): Promise<(...args: Parameters<F>) => Promise<ReturnType<F>>> {
    const contents = injectCode(fun);
    const lambdaName = (
      "ASYNCFLOW-CAL-" +
      createHash("sha256").update(contents, "utf8").digest("hex")
    ).slice(0, 64);

    const callerFile = getCallerFile()
    if (!callerFile){
      throw new Error()
    }
    const __dirname = dirname(fileURLToPath(callerFile));
    const entrypointPath = resolve(__dirname, lambdaName + '.js')
    const bundledFilePath = resolve(tmpdir(), "asyncflow", lambdaName, "index.js")
    const zipPath = resolve(tmpdir(), "asyncflow", lambdaName + '.zip')

    writeFileSync(entrypointPath, contents)

    const codeDependencies = await bundleCode(entrypointPath, bundledFilePath);
    if (!codeDependencies){
      throw new Error()
    }
    const usedEnvVariables = getUsedEnvVariables([...codeDependencies, entrypointPath]);
    const codePolicies = getCodePolicies(codeDependencies);
    const lambdaRole = await createLambdaRole(lambdaName, codePolicies);
    rmSync(entrypointPath)
    await sleep(10000)

    const zip = new AdmZip();
    zip.addLocalFile(bundledFilePath)
    zip.writeZip(zipPath);


    await sendToLambda(
      zipPath,
      lambdaName,
      usedEnvVariables,
      languageConfig.nodejs,
      lambdaRole.Role?.Arn
    )

    return async (...args) => {
      await resourceAvailable(lambdaName);

      const request = await lambdaClient.send(
        new InvokeCommand({
          FunctionName: lambdaName,
          Payload: JSON.stringify(args),
        }),
      );

      if (!request?.Payload) throw new Error("[ASYNCFLOW]: Internal failure.");

      const response = JSON.parse(
        Buffer.from(request.Payload).toString("utf8"),
      ) as {
        statusCode: number;
        body: ReturnType<F>;
      };

      if (response.statusCode == 200) {
        return response.body;
      } else {
        throw new Error("[ASYNCFLOW]: Job failed");
      }
    };
  }
}

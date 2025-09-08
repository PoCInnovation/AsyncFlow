import { createHash } from "crypto";
import { createLambda } from "./utils/lambda";
import { lambdaClient } from "./awsClients";
import { GetFunctionCommand, InvokeCommand } from "@aws-sdk/client-lambda";
import { getCodeDependencies } from "./utils/codeParser";
import { getUsedEnvVariables } from "./utils/environment";
import { getCodePolicies, createLambdaRole } from "./utils/roles";

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

export async function asyncflow<F extends (...args: any[]) => any>(
  fun: SerializableFunction<F>,
): Promise<(...args: Parameters<F>) => Promise<ReturnType<F>>> {
  const contents = fun.toString();
  const hash = createHash("sha256").update(contents, "utf8").digest("hex");

  const codeDependencies = await getCodeDependencies(contents);
  const usedEnvVariables = getUsedEnvVariables(codeDependencies);
  const codePolicies = getCodePolicies(codeDependencies);
  const lambdaRole = await createLambdaRole(hash, codePolicies);

  createLambda(hash, contents, usedEnvVariables, lambdaRole.Role?.Arn);

  return async (...args) => {
    await resourceAvailable(hash);

    const request = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: hash,
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

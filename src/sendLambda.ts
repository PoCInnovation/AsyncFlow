import {
  CreateFunctionCommand,
  Runtime,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdatedV2,
  GetFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import { readFile } from "fs/promises";
import { lambdaClient } from "./awsClients";
import { sleep } from "./utils/lambda";

async function waitForLambdaUpdate(lambdaName: string) {
  const timeoutMs = 15000;
  const pollInterval = 2000;
  const start = Date.now();

  while (true) {
    const configuration = await lambdaClient.send(
      new GetFunctionConfigurationCommand({
        FunctionName: lambdaName,
      }),
    );
    const status = configuration?.LastUpdateStatus;
    const state = configuration?.State;

    if (status === "Successful" && state === "Active") {
      break;
    }
    if (status == "Failed") {
      throw new Error(`[ASYNCFLOW]: Lambda "${lambdaName}" update failed.`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `[ASYNCFLOW]: Timeout waiting for "${lambdaName}" to be ready.`,
      );
    }
    await new Promise((resolve) => {
      setTimeout(resolve, pollInterval);
    });
  }
}

export async function sendToLambda(
  zipPath: string,
  lambdaName: string,
  envVariablesArray: Array<{ key: string; value: string }>,
  language: {
    Runtime: Runtime;
    Handler: string;
  },
  roleArn: string | undefined,
) {
  const envVariables: any = {};

  for (const envVar of envVariablesArray) {
    envVariables[envVar.key] = envVar.value;
  }

  //Now trying to follow the least priviledge practice,
  // lambdas no longer have the full access overall role, only the full access to a targeted service

  // const roleArn = await resolveRoleArn();
  // if (roleArn === undefined) {
  //   console.error("[ASYNCFLOW]: Couldn't resolve IAM role.");
  //   return;
  // }

  const zipBuffer = await readFile(zipPath);

  try {
    await lambdaClient.send(
      new UpdateFunctionCodeCommand({
        FunctionName: lambdaName,
        ZipFile: zipBuffer,
      }),
    );
    await waitForLambdaUpdate(lambdaName);
    await lambdaClient.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: lambdaName,
        Environment: {
          Variables: envVariables,
        },
      }),
    );
  } catch (err) {
    if (err instanceof Error && err.name === "ResourceNotFoundException") {
      for (let i = 0; i < 5; i++) {
        try {
          await lambdaClient.send(
            new CreateFunctionCommand({
              ...language,
              FunctionName: lambdaName,
              Role: roleArn,
              Description: `Asyncflow job "${lambdaName}"`,
              Code: { ZipFile: zipBuffer },
              Environment: {
                Variables: envVariables,
              },
            }),
          );
          return;
        } catch (err) {
          if (
            err instanceof Error &&
            err.name === "InvalidParameterValueException" &&
            err.message.includes("cannot be assumed by Lambda")
          ) {
            await sleep(3000);
          } else {
            throw err;
          }
        }
      }
    } else {
      console.error(`[ASYNCFLOW]: Failed to update "${lambdaName}".`);
    }
  }
}

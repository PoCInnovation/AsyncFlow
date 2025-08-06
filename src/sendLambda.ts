import {
  CreateFunctionCommand,
  Runtime,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import { readFile } from "fs/promises";
import { resolveRoleArn } from "./asyncflowRole";
import { lambdaClient } from "./awsClients";
import { configDotenv } from "dotenv";

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
  language: {
    Runtime: Runtime;
    Handler: string;
  },
) {
  let lambdaEnv;
  try {
    lambdaEnv = configDotenv({
      path: "asyncflow/" + lambdaName + "/.env",
    }).parsed;
  } catch (err) {
    lambdaEnv = {};
  }

  const roleArn = await resolveRoleArn();

  if (roleArn === undefined) {
    console.error("[ASYNCFLOW]: Couldn't resolve IAM role.");
    return;
  }
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
          Variables: lambdaEnv,
        },
      }),
    );
  } catch (err: any) {
    if (err.name === "ResourceNotFoundException") {
      await lambdaClient.send(
        new CreateFunctionCommand({
          ...language,
          FunctionName: lambdaName,
          Role: roleArn,
          Description: `Asyncflow job "${lambdaName}"`,
          Code: { ZipFile: zipBuffer },
          Environment: {
            Variables: lambdaEnv,
          },
        }),
      );
    } else {
      console.error(`[ASYNCFLOW]: Failed to update "${lambdaName}".`);
    }
  }
}

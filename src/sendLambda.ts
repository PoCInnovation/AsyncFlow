import {
  CreateFunctionCommand,
  Runtime,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";
import { readFile } from "fs/promises";
import { resolveRoleArn } from "./asyncflowRole";
import { lambdaClient } from "./awsClients";

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

  if (roleArn === undefined) {
    console.error("[ASYNCFLOW]: Couldn't resolve IAM role.");
    return;
  }
  const zipBuffer = await readFile(zipPath);

  try {
    const codeUpdate = await lambdaClient.send(
      new UpdateFunctionCodeCommand({
        FunctionName: lambdaName,
        ZipFile: zipBuffer,
      }),
    );
    await waitUntilFunctionUpdatedV2(
      { client: lambdaClient, maxWaitTime: 120 },
      { FunctionName: lambdaName },
    );
    await lambdaClient.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: lambdaName,
        Environment: {
          Variables: envVariables,
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
            Variables: envVariables,
          },
        }),
      );
    } else {
      console.log(err);
      console.error(`[ASYNCFLOW]: Failed to update "${lambdaName}".`);
    }
  }
}

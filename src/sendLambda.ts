import {
  CreateFunctionCommand,
  Runtime,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda";
import { readFile } from "fs/promises";
import { resolveRoleArn } from "./asyncflowRole";
import { lambdaClient } from "./awsClients";

export async function sendToLambda(
  zipPath: string,
  lambdaName: string,
  language: {
    Runtime: Runtime;
    Handler: string;
  },
) {
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
  } catch (err: any) {
    if (err.name === "ResourceNotFoundException") {
      await lambdaClient.send(
        new CreateFunctionCommand({
          ...language,
          FunctionName: lambdaName,
          Role: "arn:aws:iam::357768690498:role/asyncflow",
          Description: `Asyncflow job "${lambdaName}"`,
          Code: { ZipFile: zipBuffer },
        }),
      );
    } else {
      console.error(`[ASYNCFLOW]: Failed to update "${lambdaName}".`);
    }
  }
}

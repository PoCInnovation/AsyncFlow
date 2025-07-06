import {
  AttachRolePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
} from "@aws-sdk/client-iam";
import {
  CreateFunctionCommand,
  LambdaClient,
  Runtime,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda";
import { readFile } from "fs/promises";
import {
  ASYNCFLOW_DEFAULT_ROLE,
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
} from "./utils/constants";


async function resolveRoleArn() {
  const iam = new IAMClient({});

  try {
    const { Role: role } = await iam.send(
      new GetRoleCommand({ RoleName: ASYNCFLOW_DEFAULT_ROLE }),
    );
    if (role?.Arn) {
      return role.Arn;
    }
  } catch (err: any) {
    if (err.name !== "NoSuchEntity")
      console.error("[ASYNCFLOW]: Unhandled error while resolving IAM role.");
  }

  const assumePolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "lambda.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  });

  const { Role: newRole } = await iam.send(
    new CreateRoleCommand({
      RoleName: ASYNCFLOW_DEFAULT_ROLE,
      AssumeRolePolicyDocument: assumePolicy,
      Description: "Auto-created role for Asyncflow-managed AWS Lambdas",
    }),
  );

  if (!newRole?.Arn) {
    console.error("[ASYNCFLOW]: Failed to create IAM role.");
    return;
  }

  await iam.send(
    new AttachRolePolicyCommand({
      RoleName: ASYNCFLOW_DEFAULT_ROLE,
      PolicyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    }),
  );

  return newRole.Arn;
}

export async function sendToLambda(
  zipPath: string,
  lambdaName: string,
  language: {
    Runtime: Runtime;
    Handler: string;
},
) {
  // const roleArn = await resolveRoleArn();
  //
  // if (roleArn === undefined) {
  //   console.error("[ASYNCFLOW]: Couldn't resolve IAM role.");
  //   return;
  // }

  const client = new LambdaClient({
    region: "eu-west-3",
    credentials: {
      accessKeyId: AWS_ACCESS_KEY!,
      secretAccessKey: AWS_SECRET_KEY!,
    },
  });
  const zipBuffer = await readFile(zipPath);

  try {
    await client.send(
      new UpdateFunctionCodeCommand({
        FunctionName: lambdaName,
        ZipFile: zipBuffer,
      }),
    );
  } catch (err: any) {
    if (err.name === "ResourceNotFoundException") {
      await client.send(
        new CreateFunctionCommand({
          ...language,
          FunctionName: lambdaName,
          Role: "arn:aws:iam::357768690498:role/asyncflow",
          Description: `Asyncflow job "${lambdaName}"`,
          Code: { ZipFile: zipBuffer },
        }),
      );
    }
    console.error(`[ASYNCFLOW]: Failed to update "${lambdaName}".`);
  }
}

import {
  GetRoleCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  waitUntilRoleExists,
} from "@aws-sdk/client-iam";
import { iamClient } from "./awsClients";

const ASYNCFLOW_DEFAULT_ROLE = "AsyncflowLambdaExecutionRole";

export async function resolveRoleArn(): Promise<string | undefined> {
  try {
    const { Role: role } = await iamClient.send(
      new GetRoleCommand({ RoleName: ASYNCFLOW_DEFAULT_ROLE }),
    );
    if (role?.Arn) return role.Arn;
  } catch (err) {}

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

  const { Role: newRole } = await iamClient.send(
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

  await waitUntilRoleExists(
    { client: iamClient, maxWaitTime: 30 },
    { RoleName: ASYNCFLOW_DEFAULT_ROLE },
  );

  const policies = [
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    "arn:aws:iam::aws:policy/AWSLambda_FullAccess",
  ];

  await Promise.all(
    policies.map((p) =>
      iamClient.send(
        new AttachRolePolicyCommand({
          RoleName: ASYNCFLOW_DEFAULT_ROLE,
          PolicyArn: p,
        }),
      ),
    ),
  );

  return newRole.Arn;
}

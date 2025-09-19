import { awsServicePermissions } from "./awsServicePermissions";
import { readFileSync } from "fs";
import { isStringInCode } from "./codeParser";
import {
  CreateRoleCommand,
  AttachRolePolicyCommand,
  ListAttachedRolePoliciesCommand,
  GetRoleCommand,
  DetachRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { iamClient } from "../awsClients";

async function attachPolicies(roleName: string, policies: string[]) {
  for (const policy of policies) {
    await iamClient.send(
      new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: policy,
      }),
    );
  }
}

async function detachPolicies(
  roleName: string,
  policies: (string | undefined)[] | undefined,
) {
  if (!policies) {
    return;
  }
  for (const policy of policies) {
    await iamClient.send(
      new DetachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: policy,
      }),
    );
  }
}

export async function createLambdaRole(hash: string, policies: string[]) {
  const trustPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "lambda.amazonaws.com",
        },
        Action: "sts:AssumeRole",
      },
    ],
  };

  try {
    const newRole = await iamClient.send(
      new CreateRoleCommand({
        RoleName: hash,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      }),
    );
    attachPolicies(hash, policies);
    return newRole;
  } catch (err) {
    if (err instanceof Error && err.name != "EntityAlreadyExistsException") {
      throw err;
    } else {
      const rolePolicies = await iamClient.send(
        new ListAttachedRolePoliciesCommand({ RoleName: hash }),
      );
      const policiesToAdd = policies.filter(
        (policyArn) =>
          !rolePolicies.AttachedPolicies?.some(
            (attached) => attached.PolicyArn === policyArn,
          ),
      );
      const policiesToRemove = rolePolicies.AttachedPolicies?.filter(
        (element) => element.PolicyArn && !policies.includes(element.PolicyArn),
      ).map((element) => element.PolicyArn);
      try {
        await attachPolicies(hash, policiesToAdd);
        await detachPolicies(hash, policiesToRemove);
      } catch (err) {
        throw err;
      }
      return await iamClient.send(new GetRoleCommand({ RoleName: hash }));
    }
  }
}

export function getCodePolicies(codeDependencies: string[]): string[] {
  const relativeImports = codeDependencies.filter(
    (element) => !element.startsWith("node_modules/"),
  );

  var codeRoles = [];
  const servicesArr = Object.entries(awsServicePermissions);
  for (const relativeImport of relativeImports) {
    const file = readFileSync(relativeImport).toString();
    for (const [key, value] of servicesArr) {
      if (isStringInCode(file, key)) {
        codeRoles.push(value);
      }
    }
  }
  return codeRoles;
}

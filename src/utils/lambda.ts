import {
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
import {
  DeleteRoleCommand,
  ListAttachedRolePoliciesCommand,
  DetachRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { lambdaClient, iamClient } from "../awsClients";


async function deleteRoleCompletely(roleName: string | undefined) {
  const attachedPolicies = await iamClient.send(
    new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
  );

  const detachPromises = (attachedPolicies.AttachedPolicies ?? []).map(
    (policy) =>
      iamClient.send(
        new DetachRolePolicyCommand({
          RoleName: roleName,
          PolicyArn: policy.PolicyArn,
        }),
      ),
  );
  await Promise.all(detachPromises);

  await iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deleteBulkLambdas(
  lambdaList: (string | undefined)[] | undefined,
) {
  if (lambdaList) {
    const promises = lambdaList.map(async (lambda) => {
      await lambdaClient.send(
        new DeleteFunctionCommand({ FunctionName: lambda }),
      );
      await deleteRoleCompletely(lambda);
    });

    await Promise.all(promises);
  }
}

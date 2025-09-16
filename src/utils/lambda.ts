import { writeFileSync, mkdirSync, cpSync } from "fs";
import { dirname, resolve } from "path";
import { languageConfig } from "../utils/language";
import { sendToLambda } from "../sendLambda";
import { tmpdir } from "os";
import AdmZip from "adm-zip";
import { cwd } from "process";
import { getProjectModuleType } from "./codeParser";
import { getLambdaHandlerCode } from "./lambdaTemplate";
import {
  DeleteFunctionCommand,
  ListFunctionsCommand,
} from "@aws-sdk/client-lambda";
import {
  DeleteRoleCommand,
  ListAttachedRolePoliciesCommand,
  DetachRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { lambdaClient, iamClient } from "../awsClients";

async function deleteRoleCompletely(roleName: string | undefined) {
  // 1. Lister les policies managées attachées
  const attachedPolicies = await iamClient.send(
    new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
  );

  // 2. Détacher chaque policy
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

  // 3. Supprimer le rôle
  await iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
}

export async function deleteBulkLambdas() {
  const lambdaList = await lambdaClient.send(new ListFunctionsCommand({}));

  const promises = (lambdaList.Functions ?? [])
    .filter((lambda) => lambda.FunctionName?.startsWith("ASYNCFLOW-CAL-"))
    .map(async (lambda) => {
      await lambdaClient.send(
        new DeleteFunctionCommand({ FunctionName: lambda.FunctionName }),
      );
      await deleteRoleCompletely(lambda.FunctionName);
    });

  await Promise.all(promises);
}

export function createLambda(
  hash: string,
  contents: string,
  envVariablesArray: Array<{ key: string; value: string }>,
  iamRoleArn: string | undefined,
  codeImports: {
    nodeModules: Set<string>;
    relativeImports: Set<string>;
  },
) {
  const { nodeModules, relativeImports } = codeImports;
  const dirPath = resolve(tmpdir(), hash);
  const nodeModulesPath = resolve(dirPath, "node_modules");

  mkdirSync(dirPath, { recursive: true });
  mkdirSync(nodeModulesPath, { recursive: true });

  nodeModules.forEach((module) => {
    const src = resolve(cwd(), "node_modules", module);
    const dest = resolve(nodeModulesPath, module);
    cpSync(src, dest, { recursive: true });
  });
  relativeImports.forEach((relativeImport) => {
    const src = resolve(cwd(), relativeImport);
    const dest = resolve(dirPath, relativeImport);
    cpSync(src, dest, { recursive: true });
  });
  const { filename, code } = getLambdaHandlerCode(
    getProjectModuleType(cwd()),
    contents,
  );

  writeFileSync(resolve(dirPath, filename), code);

  const zip = new AdmZip();
  const zipPath = resolve(tmpdir(), `${hash}.zip`);
  zip.addLocalFolder(dirPath);
  zip.writeZip(zipPath);

  sendToLambda(
    zipPath,
    hash,
    envVariablesArray,
    languageConfig.nodejs,
    iamRoleArn,
  );
}

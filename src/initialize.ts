import fs from "node:fs";
import AdmZip from "adm-zip";
import { isEnvironmentValid } from "./utils/credentials";
import { getIntegrityHash } from "./utils/integrity";
import { sendToLambda } from "./sendLambda";
import { guessLanguage } from "./utils/language";
import {
  getJob,
  updateJob,
  getAllJobs,
  createAsyncflowTable,
  deleteBulkJobs,
} from "./utils/dynamodb";
import { resolve } from "node:path";
import { deleteBulkLambdas } from "./utils/lambda";
import { bundleCode } from "./utils/codeParser";
import { getUsedEnvVariables } from "./utils/environment";
import { getCodePolicies, createLambdaRole } from "./utils/roles";
import { tmpdir } from "node:os";
import { lambdaClient } from "./awsClients";
import { ListFunctionsCommand } from "@aws-sdk/client-lambda";

async function checkDeletedJobs() {
  const jobs = await getAllJobs();
  const jobsToDelete: string[] = [];

  for (const job of jobs) {
    const lambdaAttr = job["lambda_name"];
    if (!lambdaAttr || !lambdaAttr.S) continue;

    const lambdaName = lambdaAttr.S;
    const path = resolve("asyncflow", lambdaName.replace("ASYNCFLOW-DIR-", ""));
    if (!fs.existsSync(path)) {
      jobsToDelete.push(lambdaName);
    }
  }
  return jobsToDelete;
}

export async function initCallbacks() {
  const res = await lambdaClient.send(new ListFunctionsCommand({}));
  const lambdaList = res.Functions?.filter((lambda) =>
    lambda.FunctionName?.startsWith("ASYNCFLOW-CAL-"),
  ).map((lambda) => lambda.FunctionName);
  await deleteBulkLambdas(lambdaList);
}

export async function initDirectories() {
  if (!isEnvironmentValid()) return;

  //updates deleted jobs
  const jobsToDelete = await checkDeletedJobs();
  await deleteBulkLambdas(jobsToDelete);
  await deleteBulkJobs(jobsToDelete);

  await createAsyncflowTable();

  fs.mkdirSync("asyncflow", { recursive: true });

  //checks if there is any jobs
  const asyncflowDir = fs.readdirSync("asyncflow", "utf8");

  //creates temporary dir for zip files

  fs.mkdirSync(resolve(tmpdir(), "asyncflow"), { recursive: true });

  //iterates through each job
  asyncflowDir.forEach(async (dir) => {
    try {
      const language = await guessLanguage("asyncflow/" + dir);

      const jobDirectory = resolve(tmpdir(), "asyncflow", dir);
      const lambdaName = "ASYNCFLOW-DIR-" + dir;

      const zipPath = jobDirectory + ".zip";
      const bundledFilePath = resolve(jobDirectory, language.Entrypoint);

      const entrypointPath = resolve("asyncflow", dir, language.Entrypoint);
      if (!fs.existsSync(entrypointPath)) {
        throw new Error(
          "Failed to index asyncflow/" + dir + " file not found.",
        );
      }
      //creates new zip file at /tmp
      const zip = new AdmZip();

      const codeDependencies = await bundleCode(
        entrypointPath,
        bundledFilePath,
      );
      if (!codeDependencies) {
        throw new Error();
      }
      const usedEnvVariables = getUsedEnvVariables([
        ...codeDependencies,
        entrypointPath,
      ]);
      const codePolicies = getCodePolicies(codeDependencies);
      const lambdaRole = await createLambdaRole(lambdaName, codePolicies);

      zip.addLocalFolder(jobDirectory);
      zip.writeZip(zipPath);

      //generates integrity hash
      const integrityHash = getIntegrityHash({
        bundledFilePath,
        usedEnvVariables,
        codePolicies,
      });

      const job = await getJob(lambdaName);

      if (!job || job.integrityHash.S != integrityHash) {
        await updateJob(lambdaName, integrityHash);
        await sendToLambda(
          zipPath,
          lambdaName,
          usedEnvVariables,
          language,
          lambdaRole.Role?.Arn,
        );
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error(err);
        console.error(
          `[ASYNCFLOW]: Failed to initialize job "${dir}", ${err.message}.`,
        );
      }
    }
  });
}

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
  deleteJob,
} from "./utils/dynamodb";
import { resolve } from "node:path";
import { deleteLambda } from "./utils/lambda";

async function checkDeletedJobs() {
  const jobs = await getAllJobs();
  let jobsToDelete: string[] = [];

  for (const job of jobs) {
    const lambda_name = job["lambda_name"].S;
    const path = resolve("asyncflow", lambda_name);
    if (!fs.existsSync(path)) {
      jobsToDelete = jobsToDelete.concat(lambda_name);
    }
  }
  return jobsToDelete;
}

export async function initializeAsyncFlow() {
  if (!isEnvironmentValid()) return;

  //updates deleted jobs
  const jobsToDelete = await checkDeletedJobs();

  for (const job of jobsToDelete) {
    try {
      await deleteJob(job);
      await deleteLambda(job);
    } catch (err) {
      if (err instanceof Error && err.name != "ResourceNotFoundException") {
        throw err;
      }
    }
  }

  await createAsyncflowTable();

  //checks if asyncflow dir exists and throws error if not
  if (!fs.existsSync("asyncflow/")) {
    console.error("No asyncflow directory found.");
    return;
  }

  //checks if there is any jobs, throws error if not
  const asyncflowDir = fs.readdirSync("asyncflow", "utf8");
  if (asyncflowDir.length == 0) {
    return;
  }
  //creates temporary dir for zip files
  if (!fs.existsSync("/tmp/asyncflow")) {
    fs.mkdirSync("/tmp/asyncflow", { recursive: true });
  }

  //iterates through each job
  asyncflowDir.forEach(async (dir) => {
    try {
      const language = await guessLanguage("asyncflow/" + dir);

      if (language === undefined) {
        console.error(
          "[ASYNCFLOW]: Couldn't guess your job's language. Check your filesystem for filename errors or use the cli for code generation.",
        );
        return;
      }

      const zipPath = resolve("tmp", "asyncflow", dir + ".zip");
      const path = resolve("asyncflow", dir);
      if (!fs.readdirSync(path)[0]) {
        console.error("Failed to index asyncflow/" + dir, "file not found.");
        return;
      }
      //creates new zip file at /tmp
      const zip = new AdmZip();
      zip.addLocalFolder(path, "", (filename) => !filename.endsWith(".env"));
      zip.writeZip(zipPath);

      //generates integrity hash
      var integrityHash = getIntegrityHash(zipPath);
      integrityHash += getIntegrityHash(resolve(path, ".env"));

      const job = await getJob(dir);
      // @ts-ignore:
      if (!job || job.integrityHash.S != integrityHash) {
        await updateJob(dir, integrityHash);
        await sendToLambda(zipPath, dir, language);
      }
    } catch (err) {
      console.error(`[ASYNCFLOW]: Failed to initialize job "${dir}".`);
    }
  });
}

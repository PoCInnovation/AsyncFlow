import {
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import fs from "node:fs";
import AdmZip from "adm-zip";
import { isEnvironmentValid } from "./utils/credentials";
import { getIntegrityHash } from "./utils/integrity";
import { sendToLambda } from "./sendLambda";
import { guessLanguage } from "./utils/language";
import { getJob, updateJob } from "./utils/dynamodb";
import { dynamoClient } from "./awsClients";

async function waitForDbActivation(tableName: string) {
  while (true) {
    try {
      const data = await dynamoClient.send(
        new DescribeTableCommand({ TableName: tableName }),
      );
      if (data.Table && data.Table.TableStatus === "ACTIVE") {
        return;
      }
    } catch (err) {
      console.error("[ASYNCFLOW]: Error checking for database.");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function createAsyncflowTable() {
  try {
    const data = await dynamoClient.send(new ListTablesCommand({}));
    const exists = data.TableNames && data.TableNames.includes("Asyncflow");
    if (exists) {
      return;
    }
    await dynamoClient.send(
      new CreateTableCommand({
        TableName: "Asyncflow",
        KeySchema: [{ AttributeName: "lambda_name", KeyType: "HASH" }],
        AttributeDefinitions: [
          { AttributeName: "lambda_name", AttributeType: "S" },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );
    await waitForDbActivation("Asyncflow");
  } catch (_) {
    console.error("[ASYNCFLOW]: Unexpected error while creating tables");
  }
}

export async function initializeAsyncFlow() {
  if (!isEnvironmentValid()) return;

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
    const zip = new AdmZip();
    try {
      const language = await guessLanguage("asyncflow/" + dir);

      if (language === undefined) {
        console.error(
          "[ASYNCFLOW]: Couldn't guess your job's language. Check your filesystem for filename errors or use the cli for code generation.",
        );
        return;
      }

      const zipPath = "/tmp/asyncflow/" + dir + ".zip";
      const path = "asyncflow/" + dir;
      if (!fs.readdirSync(path)[0]) {
        console.error("Failed to index asyncflow/" + dir, "file not found.");
        return;
      }
      //creates new zip file at /tmp
      zip.addLocalFolder(path);
      zip.writeZip(zipPath);

      //generates integrity hash
      const integrityHash = getIntegrityHash(zipPath);

      const job = await getJob(dir);
      console.log(typeof job?.integrityHash, job?.integrityHash);
      // @ts-ignore:
      if (!job || job.integrityHash.S != integrityHash) {
        await updateJob(dir, integrityHash);
      }
      await sendToLambda(zipPath, dir, language);
    } catch (err) {
      console.error(`[ASYNCFLOW]: Failed to initialize job "${dir}".`);
    }
  });
}

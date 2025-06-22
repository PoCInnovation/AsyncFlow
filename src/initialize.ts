import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import "dotenv/config";
import fs from "node:fs";
import AdmZip from "adm-zip";
import { AWS_ACCESS_KEY, AWS_SECRET_KEY } from "./utils/constants";
import { isEnvironmentValid } from "./utils/credentials";
import { getIntegrityHash } from "./utils/integrity";
import { sendToLambda } from "./sendLambda";

async function waitForDbActivation(client: DynamoDBClient, tableName: string) {
  while (true) {
    try {
      const data = await client.send(
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

async function createAsyncflowTable(client: DynamoDBClient) {
  try {
    const data = await client.send(new ListTablesCommand({}));
    const exists = data.TableNames && data.TableNames.includes("Asyncflow");
    if (exists) {
      return;
    }
    await client.send(
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
    await waitForDbActivation(client, "Asyncflow");
  } catch (_) {
    console.error("[ASYNCFLOW]: Unexpected error while creating tables");
  }
}

export async function initializeAsyncFlow() {
  if (!isEnvironmentValid()) return;

  const client = new DynamoDBClient({
    region: "eu-west-3",
    credentials: {
      accessKeyId: AWS_ACCESS_KEY!,
      secretAccessKey: AWS_SECRET_KEY!,
    },
  });

  await createAsyncflowTable(client);

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

  const zip = new AdmZip();

  //iterates through each job
  asyncflowDir.forEach(async (dir) => {
    try {
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
      await client.send(
        new PutCommand({
          TableName: "Asyncflow",
          Item: {
            lambda_name: dir,
            integrityHash,
          },
        }),
      );

      // TODO: await sendToLambda(zipPath);
    } catch (err) {
      console.error(`[ASYNCFLOW]: Failed to initialize job "${dir}".`);
    }
  });
}

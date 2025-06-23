import fs from "node:fs";
import AdmZip from "adm-zip";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

import { getIntegrityHash } from "./utils/integrity";
import { AWS_ACCESS_KEY, AWS_SECRET_KEY } from "./utils/constants";
import { sendToLambda } from "./sendLambda";
import { guessLanguage } from "./utils/language";

// TODO: Check if the Asyncflow table exists on DynamoDB
// This is actually a challenge because I need this function to be synchronous.
// There are work arounds involving callbacks. But I'd rather not get into that right now.
// Problem for future me.
export function indexJobs() {
  const asyncflowDir = fs.readdirSync("asyncflow", "utf8");
  const zip = new AdmZip();
  const timestamp = Date.now();

  const client = new DynamoDBClient({
    region: "eu-west-3",
    credentials: {
      accessKeyId: AWS_ACCESS_KEY!,
      secretAccessKey: AWS_SECRET_KEY!,
    },
  });
  const docClient = DynamoDBDocumentClient.from(client);

  asyncflowDir.forEach(async (dir) => {
    try {
      const language = await guessLanguage("asyncflow/" + dir);

      if (language === undefined) {
        console.error(
          "[ASYNCFLOW]: Couldn't guess your job's language. Check your filesystem for filename errors or use the cli for code generation.",
        );
        return;
      }

      const command = new GetCommand({
        TableName: "Asyncflow",
        Key: {
          lambda_name: dir,
        },
        ProjectionExpression: "integrityHash",
      });
      const data = await docClient.send(command);

      const zipPath = `/tmp/asyncflow-${timestamp}-${dir}.zip`;

      zip.addLocalFolder(`asyncflow/${dir}`);
      zip.writeZip(zipPath);

      const localIntegritHash = getIntegrityHash(zipPath);

      if (!data.Item || !data.Item.integrityHash) {
        await client.send(
          new PutCommand({
            TableName: "Asyncflow",
            Item: {
              lambda_name: dir,
              integrityHash: localIntegritHash,
            },
          }),
        );

        return await sendToLambda(zipPath, dir, language);
      }

      const remoteIntegrityHash = data.Item.integrityHash as string;

      if (localIntegritHash !== remoteIntegrityHash) {
        await client.send(
          new PutCommand({
            TableName: "Asyncflow",
            Item: {
              lambda_name: dir,
              integrityHash: localIntegritHash,
            },
          }),
        );

        return await sendToLambda(zipPath, dir, language);
      }
    } catch (err) {
      console.error(`[ASYNCFLOW]: Failed to index job "${dir}".`);
    }
  });
}

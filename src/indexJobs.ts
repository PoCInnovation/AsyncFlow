import fs from "node:fs";
import AdmZip from "adm-zip";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getIntegrityHash } from "./utils/integrity";
import { sendToLambda } from "./sendLambda";
import { guessLanguage } from "./utils/language";
import { dynamoClient, dynamoDocClient } from "./awsClients";

// TODO: Check if the Asyncflow table exists on DynamoDB
// This is actually a challenge because I need this function to be synchronous.
// There are work arounds involving callbacks. But I'd rather not get into that right now.
// Problem for future me.
export function indexJobs() {
  const asyncflowDir = fs.readdirSync("asyncflow", "utf8");
  const zip = new AdmZip();
  const timestamp = Date.now();

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
      const data = await dynamoDocClient.send(command);

      const zipPath = `/tmp/asyncflow-${timestamp}-${dir}.zip`;

      zip.addLocalFolder(`asyncflow/${dir}`);
      zip.writeZip(zipPath);

      const localIntegritHash = getIntegrityHash(zipPath);

      if (!data.Item || !data.Item.integrityHash) {
        await dynamoClient.send(
          new PutCommand({
            TableName: "Asyncflow",
            Item: {
              lambda_name: dir,
              integrityHash: localIntegritHash,
            },
          }),
        );

        return await sendToLambda(zipPath, dir, [], language, undefined);
      }

      const remoteIntegrityHash = data.Item.integrityHash as string;

      if (localIntegritHash !== remoteIntegrityHash) {
        await dynamoClient.send(
          new PutCommand({
            TableName: "Asyncflow",
            Item: {
              lambda_name: dir,
              integrityHash: localIntegritHash,
            },
          }),
        );

        return await sendToLambda(zipPath, dir, [], language, undefined);
      }
    } catch (err) {
      console.error(`[ASYNCFLOW]: Failed to index job "${dir}".`);
    }
  });
}

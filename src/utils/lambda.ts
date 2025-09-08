import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { languageConfig } from "../utils/language";
import { sendToLambda } from "../sendLambda";
import { tmpdir } from "os";
import AdmZip from "adm-zip";
import { CreateRoleCommandOutput } from "@aws-sdk/client-iam";

export function createLambda(
  hash: string,
  contents: string,
  envVariablesArray: Array<{ key: string; value: string }>,
  iamRoleArn: string | undefined,
) {
  const filePath = resolve(tmpdir(), hash, "index.mjs");

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `
  export const handler = async (event) => {
    try {
      return {
        statusCode: 200,
        body: await (${contents})(...event),
      };
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify(e instanceof Error ? e.message : String(e)),
      };
    }
  };
    `,
  );

  const zip = new AdmZip();
  const zipPath = `/tmp/${hash}.zip`;

  zip.addLocalFolder(`/tmp/${hash}`);
  zip.writeZip(zipPath);

  sendToLambda(
    zipPath,
    hash,
    envVariablesArray,
    languageConfig.nodejs,
    iamRoleArn,
  );
}

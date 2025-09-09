import { writeFileSync, mkdirSync, cpSync } from "fs";
import { dirname, resolve } from "path";
import { languageConfig } from "../utils/language";
import { sendToLambda } from "../sendLambda";
import { tmpdir } from "os";
import AdmZip from "adm-zip";
import { cwd } from "process";
import { getProjectModuleType } from "./codeParser";
import { getLambdaHandlerCode } from "./lambdaTemplate";

export function createLambda(
  hash: string,
  contents: string,
  envVariablesArray: Array<{ key: string; value: string }>,
  iamRoleArn: string | undefined,
  nodeModules: Set<string>,
  relativeImports: Set<string>,
) {
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
  var { filename, code } = getLambdaHandlerCode(
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

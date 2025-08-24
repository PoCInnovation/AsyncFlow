// @ts-ignore
import strip from "strip-comments";
// @ts-ignore
import detective from "detective";

import { readFileSync } from "fs";
import { error } from "console";
import { Readline } from "node:readline/promises";

function isRelativeImport(path: string): boolean {
  return path.startsWith(".") || path.startsWith("/");
}

function isStringInCode(contents: string, varKey: string): boolean {
  const contentsWithoutComments = strip(contents);
  if (contentsWithoutComments.indexOf(varKey) != -1) {
    return true;
  }
  return false;
}

export function searchForStringInCode(
  contents: string,
  varKey: string,
): boolean {
  if (isStringInCode(contents, varKey)) {
    return true;
  }
  const files = detective(contents);
  for (const file of files) {
    if (!isRelativeImport(file)) {
      continue;
    }
    const fileContent = readFileSync(file, "utf-8");
    if (searchForStringInCode(fileContent, varKey)) {
      return true;
    }
  }
  return false;
}

export function getUsedEnvVariables(
  contents: string,
): Array<{ key: string; value: string }> {
  const envVars: Array<{ key: string; value: string }> = [];

  var envFile: string = "";
  try {
    envFile = readFileSync(".env", "utf-8");
  } catch (error: any) {
    if (error.code && error.code == "ENOENT") {
      return [];
    } else {
      throw error;
    }
  }
  const parsedEnvFile = envFile.split("\n");
  for (const envVar of parsedEnvFile) {
    const parsedEnvVar = envVar.split("=");
    if (parsedEnvVar.length != 2) {
      continue;
    }
    if (searchForStringInCode(contents, parsedEnvVar[0])) {
      console.log("found");
      envVars.push({
        key: parsedEnvVar[0],
        value: parsedEnvVar[1],
      });
    }
  }
  return envVars;
}

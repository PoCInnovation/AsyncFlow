// @ts-ignore
import strip from "strip-comments";
// @ts-ignore

import { isStringInCode, getCodeDependencies } from "./codeParser";
import { readFileSync } from "fs";

function isRelativeImport(path: string): boolean {
  return path.startsWith(".") || path.startsWith("/");
}

const lambdaReservedEnvVars = [
  "_HANDLER",
  "_X_AMZN_TRACE_ID",
  "AWS_DEFAULT_REGION",
  "AWS_REGION",
  "AWS_EXECUTION_ENV",
  "AWS_LAMBDA_FUNCTION_NAME",
  "AWS_LAMBDA_FUNCTION_MEMORY_SIZE",
  "AWS_LAMBDA_FUNCTION_VERSION",
  "AWS_LAMBDA_INITIALIZATION_TYPE",
  "AWS_LAMBDA_LOG_GROUP_NAME",
  "AWS_LAMBDA_LOG_STREAM_NAME",
  "AWS_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_LAMBDA_RUNTIME_API",
  "LAMBDA_TASK_ROOT",
  "LAMBDA_RUNTIME_DIR",
];

export function getUsedEnvVariables(
  codeDependencies: string[],
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
    if (
      parsedEnvVar.length != 2 ||
      lambdaReservedEnvVars.includes(parsedEnvVar[0])
    ) {
      continue;
    }
    for (const file of codeDependencies) {
      const fileCode = readFileSync(file).toString();
      if (isStringInCode(fileCode, parsedEnvVar[0])) {
        envVars.push({
          key: parsedEnvVar[0],
          value: parsedEnvVar[1],
        });
        break;
      }
    }
  }
  return envVars;
}

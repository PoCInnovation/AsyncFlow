import { createHash } from "crypto";
import fs from "node:fs";

export function getIntegrityHash(lambda: {
  bundledFilePath: string;
  usedEnvVariables: { key: string; value: string }[];
  codePolicies: string[];
}) {
  const stable = {
    code: fs.readFileSync(lambda.bundledFilePath).toString("utf-8"),
    // trié pour stabilité
    usedEnvVariables: [...lambda.usedEnvVariables].sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    codePolicies: [...lambda.codePolicies].sort(),
  };
  const obj = JSON.stringify(stable);
  return createHash("sha256").update(obj).digest("hex");
}

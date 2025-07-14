import { createHash } from "crypto";
import fs from "node:fs";

export function getIntegrityHash(zipPath: string) {
  const buffer = fs.readFileSync(zipPath);
  return createHash("sha256").update(buffer).digest("hex");
}

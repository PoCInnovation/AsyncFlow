import { createHash } from "crypto";
import fs from "node:fs";

export function getIntegrityHash(zipPath: string) {
  if (!fs.existsSync(zipPath)) {
    return "";
  }
  const buffer = fs.readFileSync(zipPath);
  return createHash("sha256").update(buffer).digest("hex");
}

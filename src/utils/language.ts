import { readdir } from "fs/promises";
import { extname } from "path";

import { LambdaLanguage } from "../definitions";

// TODO: I'd like a better way of doing this. I don't like guessing.
export async function guessLanguage(
  directory: string,
): Promise<LambdaLanguage | undefined> {
  const entries = await readdir(directory);
  const lower = entries.map((n) => n.toLowerCase());

  if (lower.includes("package.json") || lower.includes("index.js")) {
    return "nodejs";
  }

  if (
    lower.includes("requirements.txt") ||
    lower.includes("setup.py") ||
    lower.includes("pipfile")
  ) {
    return "python";
  }

  let jsCount = 0;
  let pyCount = 0;
  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    if (ext === ".js") jsCount++;
    else if (ext === ".py") pyCount++;
  }
  if (jsCount > pyCount) return "nodejs";
  if (pyCount > jsCount) return "python";

  return;
}

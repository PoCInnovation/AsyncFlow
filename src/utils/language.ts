import { readdir } from "fs/promises";
import { extname } from "path";
import { Runtime } from "@aws-sdk/client-lambda";
import { LambdaLanguage } from "../definitions";

const languageConfig: Record<
  LambdaLanguage,
  { Runtime: Runtime; Handler: string }
> = {
  nodejs: {
    Runtime: "nodejs22.x",
    Handler: "index.handler",
  },
  python: {
    Runtime: "python3.13",
    Handler: "lambda_function.lambda_handler",
  },
  ruby: {
    Runtime: "ruby3.4",
    Handler: "lambda_function.lambda_handler",
  },
  java: {
    Runtime: "java21",
    Handler: "example.Handler::handleRequest",
  },
};

// TODO: I'd like a better way of doing this. I don't like guessing.
export async function guessLanguage(
  directory: string,
): Promise<{ Runtime: Runtime; Handler: string } | undefined> {
  const entries = await readdir(directory);
  const lower = entries.map((n) => n.toLowerCase());

  if (lower.includes("gemfile")) {
    return languageConfig["ruby"];
  }
  if (lower.includes("package.json") || lower.includes("index.mjs")) {
    return languageConfig["nodejs"];
  }

  if (
    lower.includes("requirements.txt") ||
    lower.includes("setup.py") ||
    lower.includes("pipfile")
  ) {
    return languageConfig["python"];
  }

  type languageCount = {
    language: LambdaLanguage;
    count: number;
  };

  const languageCountMap: Record<string, languageCount> = {
    py: { language: "python", count: 0 },
    js: { language: "nodejs", count: 0 },
    rb: { language: "ruby", count: 0 },
    java: { language: "java", count: 0 },
  };

  for (const name of entries) {
    const ext = extname(name).slice(1).toLowerCase();
    if (!languageCountMap[ext]) {
      continue;
    }
    languageCountMap[ext].count++;
  }

  let maxLang: LambdaLanguage | null = null;
  let maxCount = -1;

  for (const ext in languageCountMap) {
    const entry = languageCountMap[ext];
    if (entry.count > maxCount) {
      maxCount = entry.count;
      maxLang = entry.language;
    }
  }
  if (maxLang && languageConfig[maxLang]) {
    return languageConfig[maxLang];
  }
}

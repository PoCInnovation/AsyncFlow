// @ts-ignore
import strip from "strip-comments";
// @ts-ignore
import { getNodeModules } from "./codeParser";

import { writeFileSync, readFileSync, rmSync } from "fs";
import esbuild from "esbuild";
import { resolve, join } from "path";
import { build } from "esbuild";

export async function bundleCode(path: string, outfile: string) {
  const entryPoints = [path];
  await build({
    entryPoints,
    outfile,
    bundle: true,
    platform: "node",
    target: "node20", // ou autre selon ton runtime Lambda
    external: ["aws-sdk"], // ou ['aws-sdk'] si tu veux l’exclure
  });
}

export function isStringInCode(contents: string, varKey: string): boolean {
  const contentsWithoutComments = strip(contents);
  if (contentsWithoutComments.indexOf(varKey) != -1) {
    return true;
  }
  return false;
}

export function getProjectModuleType(
  projectRoot: string,
): "ES Module" | "CommonJS" {
  try {
    const pkgPath = join(projectRoot, "package.json");
    const pkgContent = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(pkgContent);
    if (pkg.type === "module") {
      return "ES Module";
    } else {
      return "CommonJS";
    }
  } catch (e) {
    return "CommonJS";
  }
}

export function getImports(dependencies: string[]): {
  nodeModules: Set<string>;
  relativeImports: Set<string>;
} {
  const nodeModules: Set<string> = new Set();
  const relativeImports: Set<string> = new Set();

  dependencies.forEach((dep) => {
    if (!dep.startsWith("node_modules")) {
      relativeImports.add(dep);
    } else {
      const parts = dep.split("node_modules/")[1]; // remove everything before "node_modules/"
      if (parts) {
        const moduleName = parts.startsWith("@")
          ? parts.split("/").slice(0, 2).join("/") // handle scoped packages like @babel/core
          : parts.split("/")[0];
        nodeModules.add(moduleName);
      }
    }
  });

  return { nodeModules, relativeImports };
}

export function getNodeModules(dependencies: string[]): Set<string> {
  const moduleNames: Set<string> = new Set();

  dependencies.forEach((dep) => {
    if (!dep.startsWith("node_modules")) {
      return;
    }
    const parts = dep.split("node_modules/")[1]; // remove everything before "node_modules/"
    if (parts) {
      const moduleName = parts.startsWith("@")
        ? parts.split("/").slice(0, 2).join("/") // handle scoped packages like @babel/core
        : parts.split("/")[0];
      moduleNames.add(moduleName);
    }
  });
  return moduleNames;
}

export async function getCodeDependencies(code: string, isFile: boolean) {
  var fileName = "";
  if (!isFile) {
    fileName = resolve(process.cwd(), crypto.randomUUID() + ".js");
    writeFileSync(fileName, code);
  } else {
    fileName = code;
  }

  const result = await esbuild.build({
    entryPoints: [fileName],
    bundle: true,
    metafile: true,
    write: false,
    format: "cjs",
    platform: "node",
    logLevel: "silent",
  });
  const inputs = result.metafile.inputs;
  var filtered = [];
  for (const value in inputs) {
    const imports = inputs[value].imports;
    for (const i of imports) {
      if (i.path.endsWith(".js") || i.path.endsWith(".ts")) {
        filtered.push(i.path);
      }
    }
  }
  if (!isFile) {
    rmSync(fileName);
  }
  return filtered;
}

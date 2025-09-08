// @ts-ignore
import strip from "strip-comments";
// @ts-ignore

import { writeFileSync, rmSync } from "fs";
import esbuild from "esbuild";
import { resolve } from "path";

export function isStringInCode(contents: string, varKey: string): boolean {
  const contentsWithoutComments = strip(contents);
  if (contentsWithoutComments.indexOf(varKey) != -1) {
    return true;
  }
  return false;
}

export async function getCodeDependencies(code: string) {
  const fileName = resolve(process.cwd(), crypto.randomUUID() + ".js");

  writeFileSync(fileName, code);

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
  rmSync(fileName);
  return filtered;
}

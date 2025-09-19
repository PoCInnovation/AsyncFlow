// @ts-ignore
import strip from "strip-comments";
import { build } from "esbuild";

export function getCallerFile(): (string | undefined) | null {
  const originalPrepareStackTrace = Error.prepareStackTrace;

  try {
    const err = new Error();
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = err.stack as unknown as NodeJS.CallSite[];

    const caller = stack[2];
    if (!caller) return undefined;

    return caller.getFileName(); // chemin absolu du fichier appelant
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
}

export async function bundleCode(path: string, outfile: string) {
  const entryPoints = [path];
  try {
    const result = await build({
      entryPoints,
      outfile,
      bundle: true,
      metafile: true,
      write: true,
      platform: "node",
      target: "node22",
      external: ["aws-sdk"],
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
    return filtered;
  } catch (err) {
    console.log(err);
  }
}

export function isStringInCode(contents: string, varKey: string): boolean {
  const contentsWithoutComments = strip(contents);
  if (contentsWithoutComments.indexOf(varKey) != -1) {
    return true;
  }
  return false;
}

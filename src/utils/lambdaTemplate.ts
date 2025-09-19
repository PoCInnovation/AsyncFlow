export function getLambdaHandlerCode(
  type: "ES Module" | "CommonJS",
  code: string,
) {
  if (type == "ES Module") {
    return {
      filename: "index.mjs",
      code: `export const handler = async (event) => {
            try {
              return {
                statusCode: 200,
                body: await (${code})(event),
              };
            } catch (e) {
              return {
                statusCode: 500,
                body: JSON.stringify(e instanceof Error ? e.message : String(e)),
              };
            }
          };
            `,
    };
  } else {
    return {
      filename: "index.cjs",
      code: `
        exports.handler = async (event) => {
            try {
              return {
                statusCode: 200,
                body: await (${code})(event),
              };
            } catch (e) {
              return {
                statusCode: 500,
                body: JSON.stringify(e instanceof Error ? e.message : String(e)),
              };
            }
          };`,
    };
  }
}

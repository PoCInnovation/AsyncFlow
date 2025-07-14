import { InvokeCommand, InvokeCommandOutput } from "@aws-sdk/client-lambda";
import { NODE_ENV } from "./utils/constants";
import { isEnvironmentValid } from "./utils/credentials";
import { indexJobs } from "./indexJobs";
import { lambdaClient } from "./awsClients";

interface TriggerAsyncflowJobOptions<T> {
  callback?: (a: LambdaResponse<T> | null) => void;
  onrejected?: () => void;
  payload?: Record<string, any>;
}

interface LambdaResponse<T> {
  statusCode: number;
  body: T;
}

function defaultOnrejected(jobName: string) {
  console.error(`[ASYNCFLOW]: Execution failed for "${jobName}" at ${Date()}.`);
}

function callback<T>(
  res: InvokeCommandOutput,
  options?: TriggerAsyncflowJobOptions<T>,
) {
  if (options?.callback === undefined) return;

  if (res.Payload === undefined) {
    options.callback(null);
  } else {
    try {
      const payload = JSON.parse(
        Buffer.from(res.Payload).toString("utf8"),
      ) as LambdaResponse<T>;
      options.callback(payload);
    } catch (err) {
      options.callback(null);
    }
  }
}

export function triggerJob<T>(
  jobName: string,
  options?: TriggerAsyncflowJobOptions<T>,
) {
  if (!isEnvironmentValid()) return;

  if (NODE_ENV !== "production") indexJobs();

  const command = new InvokeCommand({
    FunctionName: jobName,
    InvocationType: "RequestResponse",
    Payload: options?.payload ? JSON.stringify(options.payload) : undefined,
  });

  lambdaClient
    .send(command)
    .then((res) => callback(res, options))
    .catch(() =>
      options?.onrejected ? options.onrejected() : defaultOnrejected(jobName),
    );
}

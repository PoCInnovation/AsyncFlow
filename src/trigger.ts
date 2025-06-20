import {
  LambdaClient,
  InvokeCommand,
  InvokeCommandOutput,
} from "@aws-sdk/client-lambda";
import { AWS_ACCESS_KEY, AWS_SECRET_KEY, NODE_ENV } from "./utils/constants";
import { isEnvironmentValid } from "./utils/credentials";

interface TriggerAsyncflowJobOptions {
  callback?: (a: InvokeCommandOutput) => void;
  onrejected?: () => void;
  payload?: Record<string, any>;
}

function defaultOnrejected(jobName: string) {
  console.error(`[ASYNCFLOW]: Execution failed for "${jobName}" at ${Date()}.`);
}

export function triggerJob(
  jobName: string,
  options?: TriggerAsyncflowJobOptions,
) {
  if (!isEnvironmentValid()) return;

  const client = new LambdaClient({
    credentials: {
      accessKeyId: AWS_ACCESS_KEY!,
      secretAccessKey: AWS_SECRET_KEY!,
    },
  });

  const command = new InvokeCommand({
    FunctionName: jobName,
    InvocationType: "Event",
    Payload: options?.payload ? JSON.stringify(options.payload) : undefined,
  });

  client
    .send(command)
    .then(options?.callback)
    .catch(() =>
      options?.onrejected ? options.onrejected() : defaultOnrejected(jobName),
    );
}

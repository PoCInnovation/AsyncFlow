import { DeleteFunctionCommand } from "@aws-sdk/client-lambda";
import { lambdaClient } from "../awsClients";

export async function deleteLambda(lambda_name: string) {
  try {
    await lambdaClient.send(
      new DeleteFunctionCommand({
        FunctionName: lambda_name,
      }),
    );
  } catch (err) {
    throw err;
  }
}

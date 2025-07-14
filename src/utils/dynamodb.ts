import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../awsClients";

export async function updateJob(lambda_name: string, integrityHash: string) {
  return await dynamoClient.send(
    new PutCommand({
      TableName: "Asyncflow",
      Item: {
        lambda_name,
        integrityHash,
      },
    }),
  );
}

export async function getJob(lambda_name: string) {
  const res = await dynamoClient.send(
    new GetItemCommand({
      TableName: "Asyncflow",
      Key: {
        lambda_name: {
          S: lambda_name,
        },
      },
    }),
  );

  return res.Item;
}

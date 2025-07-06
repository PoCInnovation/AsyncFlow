import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb"
import { unmarshall } from "@aws-sdk/util-dynamodb";

export async function updateJob(client :DynamoDBClient, lambda_name: string, integrityHash: string)
{
    return await client.send(
        new PutCommand({
          TableName: "Asyncflow",
          Item: {
            lambda_name,
            integrityHash,
          },
        }),
      );
}

export async function getJob(client :DynamoDBClient, lambda_name: string)
{
    const res = await client.send(new GetItemCommand({
        TableName: "Asyncflow",
        Key : {
          lambda_name : {
            S: lambda_name
          }
        }
      }))

      var job
      if (res.Item){
        job = unmarshall(res.Item)
      }
      return job
}

import {
  DeleteItemCommand,
  GetItemCommand,
  ScanCommand,
  ScanCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../awsClients";
import {
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";

async function waitForDbActivation(tableName: string) {
  while (true) {
    try {
      const data = await dynamoClient.send(
        new DescribeTableCommand({ TableName: tableName }),
      );
      if (data.Table && data.Table.TableStatus === "ACTIVE") {
        return;
      }
    } catch (err) {
      console.error("[ASYNCFLOW]: Error checking for database.");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export async function createAsyncflowTable() {
  try {
    const data = await dynamoClient.send(new ListTablesCommand({}));
    const exists = data.TableNames && data.TableNames.includes("Asyncflow");
    if (exists) {
      return;
    }
    await dynamoClient.send(
      new CreateTableCommand({
        TableName: "Asyncflow",
        KeySchema: [{ AttributeName: "lambda_name", KeyType: "HASH" }],
        AttributeDefinitions: [
          { AttributeName: "lambda_name", AttributeType: "S" },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );
    await waitForDbActivation("Asyncflow");
  } catch (_) {
    console.error("[ASYNCFLOW]: Unexpected error while creating tables");
  }
}

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

export async function getAllJobs() {
  let jobs: any[] = [];
  let ExclusiveStartKey = undefined;

  do {
    const data: ScanCommandOutput = await dynamoClient.send(
      new ScanCommand({
        TableName: "Asyncflow",
        ExclusiveStartKey,
      }),
    );
    jobs = jobs.concat(data.Items);
    ExclusiveStartKey = data.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return jobs;
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

export async function deleteJob(lambda_name: string) {
  const res = await dynamoClient.send(
    new DeleteItemCommand({
      TableName: "Asyncflow",
      Key: {
        lambda_name: {
          S: lambda_name,
        },
      },
    }),
  );
  return res;
}

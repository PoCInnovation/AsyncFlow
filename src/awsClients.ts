import { LambdaClient } from "@aws-sdk/client-lambda";
import { AWS_ACCESS_KEY, AWS_SECRET_KEY } from "./utils/constants";
import { IAMClient } from "@aws-sdk/client-iam";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const lambdaClient = new LambdaClient({
  region: "eu-west-3",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY!,
    secretAccessKey: AWS_SECRET_KEY!,
  },
});

export const iamClient = new IAMClient({
  region: "eu-west-3",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY!,
    secretAccessKey: AWS_SECRET_KEY!,
  },
});

export const dynamoClient = new DynamoDBClient({
  region: "eu-west-3",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY!,
    secretAccessKey: AWS_SECRET_KEY!,
  },
});

export const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

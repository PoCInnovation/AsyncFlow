import { CreateTableCommand, DescribeTableCommand, DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';
import 'dotenv/config'
import fs from 'node:fs';
import AdmZip from 'adm-zip';

function getIntegrityHash(zipPath)
{
    const buffer = fs.readFileSync(zipPath)
    const integrityHash = createHash("sha256").update(buffer).digest('hex')
    return integrityHash
}

async function waitForDbActivation(client, tableName)
{
    while (true) {
        try {
            const data = await client.send(new DescribeTableCommand({ TableName: tableName }));
            if (data.Table.TableStatus === "ACTIVE") {
                console.log(`Table ${tableName} is ACTIVE`);
                return;
            }
        } catch(err) {
            if (err.name !== "ResourceNotFoundException"){
                throw err
            }
        }
        await new Promise(resolve => setTimeout(resolve, 3000))
    }
}

async function createAsyncflowTable (client){
    try {
        const data = await client.send(new ListTablesCommand({}));
        const exists = data.TableNames.includes("Asyncflow");
        if (exists){
            return
        }
        console.log("Creating Asyncflow table")
        await client.send(new CreateTableCommand({
            TableName: 'Asyncflow',
            KeySchema: [
                { AttributeName: 'lambda_name', KeyType: 'HASH' },
            ],
            AttributeDefinitions: [
                { AttributeName: 'lambda_name', AttributeType: 'S' },
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5,
            }}))
        await waitForDbActivation(client, "Asyncflow")
    } catch (err){
        throw err
    }
}

export async function initializeAsyncFlow(){
    const awsAccessKey = process.env.AWS_ACCESS_KEY
    const awsSecretKey = process.env.AWS_SECRET

    const client = new DynamoDBClient({
        region: 'eu-west-3',
        credentials:  {
            accessKeyId: awsAccessKey,
            secretAccessKey: awsSecretKey
        }
    })
    try {
        await createAsyncflowTable(client)


        //checks if asyncflow dir exists and throws error if not
        if (!fs.existsSync('asyncflow/')){
            throw new Error("No asyncflow directory found.")
        }
        //checks if there is any jobs, throws error if not
        const asyncflowDir = fs.readdirSync("asyncflow", 'utf8', {flag: 'r'})
        if (asyncflowDir.length == 0){
            console.log("No jobs found")
            return
        }
        //creates temporary dir for zip files
        if (!fs.existsSync("asyncflow/tmp")){
            fs.mkdirSync("asyncflow/tmp", {rescursive: true})
        }


        const zip = new AdmZip()

        //iterates through each job
        asyncflowDir.forEach(async (dir)=>{
            try {
                const zipPath = "asyncflow/tmp/" + dir + ".zip"
                if (dir == "tmp"){
                    return
                }
                const path = "asyncflow/" + dir
                if (!fs.readdirSync(path)[0]){
                    console.log("Failed to index asyncflow/" + dir, "file not found.")
                    return
                }
                //creates new zip file at /tmp
                zip.addLocalFolder(path)
                zip.writeZip(zipPath)
                console.log("Successfully zipped at", zipPath)

                //generates integrity hash
                const integrityHash = getIntegrityHash(zipPath)
                await client.send(new PutCommand({TableName: 'Asyncflow', Item: {
                    lambda_name: dir,
                    integrityHash,
                }}))
                console.log("sent")

                //to implement next
            } catch (err) {
                throw new Error(err)
            }
        })
      } catch (err) {
        throw new Error(err)
    }


}

> If you see this section, you've just created a repository using [PoC Innovation's Open-Source project template](https://github.com/PoCInnovation/open-source-project-template). Check the [getting started guide](./.github/getting-started.md).

## Development Status

AsyncFlow is currently under prototype development.

# AsyncFlow

AsyncFlow, a JS library that simplifies asynchronous task management by automating workflows on the cloud (AWS, Google Cloud, Azure), focusing on scalability and cost optimization.
We provide an SDK to interact with your cloud provider's API.

## Our Goals

- **Decrease Complexity:**
  Reduce the requirements for extensive configurations and simplify troubleshooting on the developer's side. No more worker queues and setting up infrastructure.
- **Improve Deployment Speed:**
  Enable tasks to run on-demand directly from the cloud environment.
- **Maintain Clear Monitoring:**
  Deliver ongoing, real-time tracking of all active workflows.

### How does it work?

AsyncFlow simplifies cloud function execution by providing a lightweight SDK that abstracts away the complexity of the AWS infrastructure.

Instead of directly managing functions, permissions, or deployments, you use our SDK to define and trigger asynchronous tasks through a unified API.

Asyncflow will handle everything, from environment variables to dependencies and role permissions.

## Getting Started

### Installation

AsyncFlow presents itself as a node package.

```bash
npm install asyncflow-sdk
```

You might want to use our CLI in order to use Asyncflow using directories.

```bash
npm -g install asyncflow-cli
```

### Quickstart

To use AsyncFlow with AWS, you need to provide your AWS credentials. Create a **.env** file at the root of your project:

```bash
your-project/
├── .env
├── src/
├── package.json
└── README.md
```

Then, provide your AWS credentials, **AWS_ACCESS_KEY** and **AWS_SECRET_KEY**

```bash
//.env

AWS_ACCESS_KEY=XXXXXXX
AWS_SECRET_KEY=XXXXXXXXXXXXXXXXXXXXX
```

Make sure the user associated with these credentials has the necessary permissions to perform all intended actions. We recommend following the principle of least privilege.

### Usage

First, call

```ts
import "dotenv/config";
import { Asyncflow } from "asyncflow-sdk";
```

to retrieve the credentials you declared in the .env file you created at your project's root, as explained above. Then import the `Asyncflow` library. The order is important, since Asyncflow cannot work without having your credentials.

Then, you need to first initialize the Asyncflow client, with the `Asyncflow.init` method. It takes two parameters, `initializeDirectories` and `initializeCallbacks`, that are both `true` by default.

You can disable them if you're not working with them.

```ts
import "dotenv/config";
import { Asyncflow } from "asyncflow-sdk";

const asyncflowClient = await Asyncflow.init({
  // initializeDirectories: true,
  // initializeCallbacks: true,
});
```

You can create jobs with Asyncflow in two different ways, depending on your needs and project structure:

## 1. Using Asyncflow SDK wrapper

Use the `Asyncflow.addJob` method to declare a new job by passing a callback function that contains the code to be executed asynchronously. It will return an asynchronous function that can then be used to trigger the job you've added. You can pass to the asynchronous function any arguments, it will then be used as a payload that will be passed to the job in the cloud.

```ts
import "dotenv/config";
import { Asyncflow } from "asyncflow-sdk";

const asyncflowClient = await Asyncflow.init();

const githubCall = await asyncflowClient.addJob(() => {
  const response = await fetch("https://api.github/...");
  return response;
});
// The job is now created, you can now invoke it whenever you want
const githubCallResult = await githubCall();
console.log(githubCallResult);

const analysis = await asyncflowClient.addJob((multiplier: number) => {
  return 42 * multiplier;
});
const analysisResult = await analysis(21);
```

## 2. Using Asyncflow CLI

Use the `asyncflow-cli` to create directories with jobs boilerplates

```bash
asyncflow-cli create foobar node
```

```bash
asyncflow/
└── foobar/
    ├── index.js
    └── package.json

Job name : foobar
```

```ts
// ./asyncflow/foobar/index.js

export const handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify("Hello from Lambda!"),
  };
  return response;
};
```

The command above creates a directory inside `asyncflow/` named `foobar` with a `index.js` and `package.json` file inside. The job will have the same name as the directory name. You can then write code inside this directory.

You only need to initialize the Asyncflow client — it will automatically create the jobs located in your `asyncflow/` directory, if they don't already exist.

To trigger a job created during initialization, use `Asyncflow.trigger`, which takes two parameters: the name of the job, and an optional configuration object.

You can pass the following options:

```ts
LambdaResponse<T> {
  statusCode: number;
  body: T;
}

options: {
  payload?: Record<string, any>;
  callback?: (a: LambdaResponse<T> | null) => void;
  onrejected?: (err: any) => void;
}
```

```ts
import "dotenv/config";
import { Asyncflow } from "asyncflow-sdk";

const asyncflowClient = await Asyncflow.init();

asyncflowClient.triggerDirectoryJob("foobar", {
  callback: (res) => {
    console.log(res);
  },
  onrejected: (err) => {
    console.error(err);
  },
  payload: { statusCode: 200, body: "this is a payload" },
});
```

As simple as that!

## Get involved

You're invited to join this project ! Check out the [contributing guide](./CONTRIBUTING.md).

If you're interested in how the project is organized at a higher level, please contact the current project manager.

## Our PoC team ❤️

Developers
| [<img src=".github/assets/pierre.png" width=85><br><sub>Pierre Riss</sub>](https://github.com/MrZalTy) | [<img src=".github/assets/loan.jpeg" width=85><br><sub>Loan Riyanto</sub>](https://github.com/skl1017) | [<img src=".github/assets/laurent.jpg" width=85><br><sub>Laurent Gonzalez</sub>](https://github.com/lg-epitech)
| :---: | :---: | :---: |

Manager
| [<img src="https://github.com/pierrelissope.png?size=85" width=85><br><sub>Pierre Lissopé</sub>](https://github.com/pierrelissope)
| :---: |

<h2 align=center>
Organization
</h2>

<p align='center'>
    <a href="https://www.linkedin.com/company/pocinnovation/mycompany/">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn logo">
    </a>
    <a href="https://www.instagram.com/pocinnovation/">
        <img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram logo"
>
    </a>
    <a href="https://twitter.com/PoCInnovation">
        <img src="https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white" alt="Twitter logo">
    </a>
    <a href="https://discord.com/invite/Yqq2ADGDS7">
        <img src="https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white" alt="Discord logo">
    </a>
</p>
<p align=center>
    <a href="https://www.poc-innovation.fr/">
        <img src="https://img.shields.io/badge/WebSite-1a2b6d?style=for-the-badge&logo=GitHub Sponsors&logoColor=white" alt="Website logo">
    </a>
</p>

> 🚀 Don't hesitate to follow us on our different networks, and put a star 🌟 on `PoC's` repositories

> Made with ❤️ by PoC

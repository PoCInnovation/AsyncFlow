import {fileURLToPath} from 'node:url'
import { dirname, resolve } from 'node:path';


export const DIRNAME = resolve(fileURLToPath(import.meta.url), '../../')
export const TEMPLATE_PATH = resolve(DIRNAME, 'config', 'templates')

export const ASYNCFLOW_LANGUAGES = [
    {
      language: 'python',
      extension: 'py',
      filename: 'lambda_function'
    },
    {
      language: 'ruby',
      extension: 'rb',
      filename: 'lambda_function'
    },
    {
      language: 'java',
      extension: 'java'
    },
    {
      language: 'node',
      extension: 'mjs',
      filename: 'index'
    }
  ];

export const ASYNCFLOW_FOLDER_NAME = 'asyncflow'

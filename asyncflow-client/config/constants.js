import {fileURLToPath} from 'node:url'
import { dirname, resolve } from 'node:path';


export const DIRNAME = resolve(fileURLToPath(import.meta.url), '../../')
export const TEMPLATE_PATH = resolve(DIRNAME, 'config', 'templates')

export const ASYNCFLOW_LANGUAGES = [
    {
      language: 'python',
      extension: 'py'
    },
    {
      language: 'go',
      extension: 'go'
    },
    {
      language: 'java',
      extension: 'java'
    },
    {
      language: 'node',
      extension: 'js'
    }
  ];

export const ASYNCFLOW_FOLDER_NAME = 'asyncflow'

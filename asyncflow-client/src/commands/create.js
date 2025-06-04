import fs from 'node:fs';
import {ASYNCFLOW_LANGUAGES, ASYNCFLOW_FOLDER_NAME, DIRNAME} from '../../config/constants.js'
import { generateHandler } from '../utils/generateHandler.js';

export const command = "create"
export const describe = "Create a new asyncFlow template"

export const builder = (yargs) =>{
    return yargs.positional('file',{
        type: 'string',
        description: 'Filename of your template',
    })
    .positional('language', {
        type: 'string',
        description : 'Language of your asyncFlow template'
    })
    .check((argv)=>{
        if (argv._.length > 3){
            throw new Error('Too many arguments')
        }
        if (argv._.length < 3){
            throw new Error('Not enough arguments')
        }
        const asyncFlowLanguage = ASYNCFLOW_LANGUAGES.find(lang => lang.language == argv._[2])
        if (!asyncFlowLanguage){
            throw new Error('Invalid language')
        }
        argv.language = asyncFlowLanguage
        argv.file = argv._[1]
        return true
    })
}

export const handler = (argv) =>{
    const fileName = argv.file + '.' + argv.language.extension
    const fullPath = ASYNCFLOW_FOLDER_NAME + '/' + argv.file + '/' + fileName

    try {
        fs.mkdirSync(ASYNCFLOW_FOLDER_NAME, {recursive: true})
        if (!fs.existsSync(ASYNCFLOW_FOLDER_NAME + '/' + argv.file)){
            fs.mkdirSync(ASYNCFLOW_FOLDER_NAME + '/' + argv.file)
        } else {
            console.log('Job already exists')
            return
        }
        const generatedTemplate = generateHandler(argv.file, argv.language.language)
        fs.writeFileSync(fullPath, generatedTemplate)
        console.log('File created', fullPath)
    } catch (err){
        throw new Error(err)
    }
}

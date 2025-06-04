import mustache from "mustache"
import fs from 'node:fs';
import { TEMPLATE_PATH } from "../../config/constants.js";
import { resolve } from "node:path";

export const generateHandler = (handlerName, language) =>{
    if (language == 'java' || language == 'go'){
        handlerName = handlerName[0].toUpperCase() + handlerName.slice(1)
    }
    const templateName = language + '.mustache'
    try {
    const template = fs.readFileSync(resolve(TEMPLATE_PATH, templateName)).toString()
        const generatedTemplate = mustache.render(template, {handlerName: handlerName})
        return generatedTemplate
    } catch (err) {
        throw new Error(err)
    }
}

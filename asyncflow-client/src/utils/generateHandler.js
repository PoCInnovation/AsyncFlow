import fs from 'node:fs';
import { TEMPLATE_PATH } from "../../config/constants.js";
import { resolve } from "node:path";

export const generateHandler = (language) =>{
    try {
    const template = fs.readFileSync(resolve(TEMPLATE_PATH, language)).toString()
    return template
    } catch (err) {
        throw new Error(err)
    }
}

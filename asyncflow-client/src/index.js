import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as create from '../src/commands/create.js'



export function main(){
    yargs(hideBin(process.argv))
  .command(create)
  .demandCommand(1, 'Tu dois fournir une commande.')
  .help()
  .parse();

}


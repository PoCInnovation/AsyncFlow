import fs from 'node:fs';

export const command = "init"
export const describe = "Initialize your AsyncFlow project"

export const builder = (yargs) =>{
    return yargs.positional('aws_access_key',{
        type: 'string',
        description: 'Your AWS access key',
    })
    .positional('aws_secret', {
        type: 'string',
        description : 'Your AWS secret'
    })
    .check((argv)=>{
        if (argv._.length > 3){
            throw new Error('Too many arguments')
        }
        if (argv._.length < 3){
            console.log('AWS credentials initialized but empty, please write your them in the .env file')
            argv.is_credentials = false
        } else {
            console.log('AWS credentials initialized in .env file')
            argv.is_credentials = true
            argv.aws_access_key = argv._[1]
            argv.aws_secret = argv._[2]
        }
        return true
    })
}

export const handler = (argv) =>{

    var aws_access_key_exists = false
    var aws_secret_exists = false

    try {
        if (fs.existsSync('.env')){
            var data = fs.readFileSync('.env', 'utf8', {flag: 'r'});
            data = data.split('\n')
            data.forEach(env_var =>{
                if (env_var.indexOf('AWS_ACCESS_KEY=') == 0){
                    aws_access_key_exists = true
                }
                if (env_var.indexOf('AWS_SECRET=') == 0){
                    console.log('AWS_SECRET EXISTS')
                    aws_secret_exists = true
                }
            })
        }
      } catch (err) {
        console.error(err);
    }

    var aws_access_key = 'AWS_ACCESS_KEY='
    var aws_secret = 'AWS_SECRET='
    var content = ''

    if (argv.is_credentials){
        aws_access_key = aws_access_key + argv.aws_access_key
        aws_secret = aws_secret + argv.aws_secret
    }
    if (!aws_access_key_exists){
        content = content + aws_access_key + '\n'
    }
    if (!aws_secret_exists){
        content = content + aws_secret + '\n'
    }
    fs.appendFile('.env', content, {encoding: 'utf-8', flag: 'a'}, err => {
        if (err) {
          console.error(err);
        } else {
        }
      });

}

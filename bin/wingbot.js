#!/usr/bin/env node
/*
 * @author David Menger
 */
'use strict';

const vorpal = require('vorpal')();
const fs = require('fs');
const path = require('path');
const main = require('../main');
const spinner = require('../src/spinner');
const login = require('../src/login');
const deploy = require('../src/deploy');
const compressAndStream = require('../src/compressAndStream');
// const config = require('../src/config');

const chalk = vorpal.chalk;

function errorHandler (ctx, s) {
    return (e) => {
        if (s) {
            s.stop(true);
        }
        ctx.log(chalk.red(`\nError: ${e.message}`));
        if (Array.isArray(e.errors)) {
            e.errors.forEach(err => ctx.log(chalk.yellow(` ${err.dataPath}: ${err.message}`)));
        }
    };
}

vorpal
    .command('login')
    .description(chalk.blue('Sign in to application'))
    .action(function () {
        let email = null;
        let password = null;
        const s = spinner();
        return this.prompt([{
            type: 'input',
            message: chalk.cyan(' What is your email? '),
            name: 'email'
        }, {
            type: 'password',
            message: chalk.cyan(' What is your password? '),
            name: 'password'
        }])
            .then((e) => {
                email = e.email;
                password = e.password;
                s.start();

                return login(email, password);
            })
            .then(() => {
                s.stop(true);
                this.log(chalk.green('Successfully signed in! Welcome!'));
            })
            .catch(errorHandler(this, s));
    });

vorpal
    .command('model deploy <id> <file>')
    .description(chalk.blue('Package and deploy new version of the API'))
    .option('-t, --token', 'Force the token')
    .action(function (args) {
        const match = args.file.match(/[^/\\]+\.(bin|ftz)$/);

        if (!match) {
            this.log(chalk.red('Error: you shoud deploy ftz or bin file'));
            return Promise.resolve();
        }

        const s = spinner();

        s.start();

        const sourceFile = fs.createReadStream(path.resolve(process.cwd(), args.file));

        return compressAndStream(sourceFile, progress => s.setSpinnerTitle(progress))
            .then(file => deploy.deploy(args.id, file, args.options.token))
            .then(() => {
                s.stop(true);
                this.log(chalk.green('Successfully uploaded!'));
            })
            .catch(errorHandler(this, s));
    });

vorpal
    .command('model list')
    .description(chalk.blue('List all available models on API'))
    .action(function () {
        const s = spinner();

        s.start();

        return deploy.list()
            .then((list) => {
                s.stop(true);
                list.data.forEach((deployment) => {
                    this.log(`  ${deployment.id}\t\t${deployment.endpoint}`);
                });
            })
            .catch(errorHandler(this, s));
    });

vorpal
    .command('model delete <id>')
    .description(chalk.blue('Removes model from API'))
    .action(function (args) {
        const s = spinner();

        s.start();

        return deploy.remove(args.id)
            .then(() => {
                s.stop(true);
                this.log(chalk.green('Successfully removed!'));
            })
            .catch(errorHandler(this, s));
    });

vorpal
    .command('jsonToText <fromJson> <toText>')
    .description(chalk.blue('Convert JSON to text format'))
    .option('-m, --multiply', 'Multiply the learning set with entities')
    .action(function (args) {
        const from = path.resolve(process.cwd(), args.fromJson);
        const to = path.resolve(process.cwd(), args.toText);

        const pipeline = [];
        let promise = Promise.resolve();

        if (args.options.multiply) {
            const entities = new main.EntitiesFromJson(from);

            promise = entities.loadEntities();

            pipeline.push(new main.MultiplicatorStream(
                (cat, w) => entities.getWordList(cat, w)
            ));
        }

        return promise
            .then(() => main.jsonToText(from, to, pipeline))
            .then(() => this.log(chalk.green('Done!')))
            .catch(errorHandler(this));
    });

vorpal
    .command('wikiToText <fromJson> <toText>')
    .description(chalk.blue('Convert JSON to text format'))
    .action(function (args) {
        const from = path.resolve(process.cwd(), args.fromJson);
        const to = path.resolve(process.cwd(), args.toText);

        return main.wikiToText(from, to)
            .then(() => this.log(chalk.green('Done!')))
            .catch(errorHandler(this));
    });

vorpal
    .catch('[words...]', 'Catches incorrect commands')
    .action(function (args) {
        if (args.words) {
            const cmd = args.words.join(' ');
            this.log(`${cmd} is not a valid command.`);
            return null;
        }
        return vorpal.execSync('help');
    });

vorpal
    .delimiter('')
    .show()
    .parse(process.argv);

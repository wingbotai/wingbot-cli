#!/usr/bin/env node
/*
 * @author David Menger
 */
'use strict';

const commander = require('commander');
const chalk = require('chalk');
const attach = require('../src/cli/attach');
const { deploy, list } = require('../src/model');

commander
    .command('deploy <id> <file>')
    .description(chalk.blue('Package and deploy new version of the API'))
    .option('-t, --token', 'Force the token')
    .action(attach(deploy));

commander
    .command('list')
    .description(chalk.blue('List all available models on API'))
    .action(attach(list));

commander.parse(process.argv);

if (!process.argv.slice(2).length) {
    commander.help();
}

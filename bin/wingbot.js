#!/usr/bin/env node
/*
 * @author David Menger
 */
'use strict';

const commander = require('commander');
const chalk = require('chalk');
const attach = require('../src/cli/attach');
const { init, update } = require('../src/init');
const login = require('../src/login');
const wikiToText = require('../src/wikiToText');
const jsonToText = require('../src/jsonToText');

// @ts-ignore
const pack = require('../package.json');

commander.version(pack.version, '-v --version');

commander
    .command('init')
    .option('-w')
    .description(chalk.blue('Create a new project'))
    .action(attach(init));

commander
    .command('update')
    .description(chalk.blue('Create an existing project'))
    .action(attach(update));

commander
    .command('cluster', chalk.blue('Run clusterization on Analytics event export'));

commander
    .command('login')
    .description(chalk.blue('Sign in to application'))
    .action(attach(login));

commander
    .command('jsonToText <fromJson> <toText>')
    .description(chalk.blue('Convert Rasa JSON to fasttext training data'))
    .option('-m, --multiply', 'Multiply the learning set with entities')
    .action(attach(jsonToText));

commander
    .command('wikiToText <fromWikiXml> <toText>')
    .description(chalk.blue('Convert wikipedia data to fasttext training data'))
    .action(attach(wikiToText));

commander
    .command('help')
    .description(chalk.blue('Prints this message'))
    .action(() => commander.help());

commander.parse(process.argv);

if (!process.argv.slice(2).length) {
    commander.help();
}

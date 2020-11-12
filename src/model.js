/*
 * @author David Menger
 */
'use strict';

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const spinAndCatch = require('./cli/spinAndCatch');
const compressAndStream = require('./textTools/compressAndStream');
const deployer = require('./deploy');

const { log } = console;

async function deploy (id, file, cmd) {
    const match = file.match(/[^/\\]+\.(bin|ftz)$/);

    if (!match) {
        this.log(chalk.red('Error: you shoud deploy ftz or bin file'));
        return;
    }

    const sourceFile = fs.createReadStream(path.resolve(process.cwd(), file));

    await spinAndCatch(async (s) => {
        const updaterFn = (progress) => s.setSpinnerTitle(progress);
        const fileStream = await compressAndStream(sourceFile, updaterFn);
        await deployer.deploy(id, fileStream, cmd.token);
    });

    log(chalk.green('Successfully uploaded!'));
}

async function list () {
    const { data } = await spinAndCatch(() => deployer.list());

    data.forEach((deployment) => {
        const sep = ' '.repeat(40 - deployment.id.length);
        log(`  ${deployment.id}${sep}${deployment.endpoint}`);
    });
}

module.exports = {
    deploy,
    list
};

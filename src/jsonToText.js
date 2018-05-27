/*
 * @author David Menger
 */
'use strict';

const chalk = require('chalk');
const path = require('path');
const EntitiesFromJson = require('./textTools/EntitiesFromJson');
const MultiplicatorStream = require('./textTools/MultiplicatorStream');
const jsonToText = require('./textTools/jsonToText');
const spinAndCatch = require('./cli/spinAndCatch');

const { log } = console;

async function jsonToTextFn (fromJson, toText, cmd) {

    const from = path.resolve(process.cwd(), fromJson);
    const to = path.resolve(process.cwd(), toText);

    const pipeline = [];

    if (cmd.options.multiply) {
        const entities = new EntitiesFromJson(from);

        await spinAndCatch(() => entities.loadEntities());

        const getVariants = (cat, w) => entities.getWordList(cat, w);
        pipeline.push(new MultiplicatorStream(getVariants));
    }

    await spinAndCatch(() => jsonToText(from, to, pipeline));

    log(chalk.green('Done!'));
}

module.exports = jsonToTextFn;

/*
 * @author David Menger
 */
'use strict';

const chalk = require('chalk');

const { log } = console;

function attach (fn) {
    return (...args) => {
        fn(...args)
            .catch((e) => {
                log(chalk.red(`\nError: ${e.message}`));

                if (Array.isArray(e.errors)) {
                    e.errors.forEach(err => log(chalk.yellow(` ${err.dataPath}: ${err.message}`)));
                }
            });
    };
}

module.exports = attach;

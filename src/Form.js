/*
 * @author David Menger
 */
'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const crypto = require('crypto');

const YES = 'Yes';
const NO = 'No';

const NO_YES = [NO, YES];
const YES_NO = [YES, NO];

class Form {

    constructor (options, previousData = {}) {
        this.options = options;
        this.previousData = previousData;
        this.data = {};
    }

    assign (obj) {
        Object.assign(this.data, obj);
    }

    randomSha () {
        const hash = crypto.createHash('sha1');
        for (let i = 0; i < 10; i++) {
            hash.update(`${Math.random() * i}${Date.now() + i}`);
        }
        return hash.digest('hex');
    }

    group (header, paragraph, textLabel) {
        return `\n${chalk.bold.green(header)}\n${'-'.repeat(header.length)}\n${chalk.gray(paragraph)}\n\n${chalk.green('?')} ${textLabel}`;
    }

    label (title, description = null, optional = false) {
        const color = optional ? 'cyan' : 'cyan';
        let ret = chalk[color].bold(` ${title} `);
        if (description) {
            ret += `\n    ${optional ? chalk.white('(optional) ') : ''}${chalk.gray(`${description} `)}`;
        }
        return ret;
    }

    list (name, message, defaults = null, filterFn = (() => true)) {
        const choices = this.options[name];

        const ret = {
            type: 'list',
            name,
            message,
            choices: Object.keys(this.options[name]).filter((key) => filterFn(choices[key])),
            filterFn,
            filter: (val) => choices[val]
        };

        if (defaults) {
            Object.assign(ret, { default: defaults });
        }

        return ret;
    }

    yesNo (name, message, choices = YES_NO) {
        return {
            type: 'list',
            name,
            message,
            choices,
            filter: (choice) => choice === 'Yes'
        };
    }

    async ask (questions) {
        const prompts = questions.map((input) => {

            if (typeof this.previousData[input.name] === 'undefined') {
                return input;
            }

            let def = this.previousData[input.name];

            if (typeof def === 'boolean') {
                def = def
                    ? YES
                    : NO;
            } else if (typeof this.options[input.name] === 'object') {
                Object.keys(this.options[input.name])
                    .some((key) => {
                        const val = this.options[input.name][key];

                        if (val !== def) {
                            return false;
                        }
                        def = key;
                        return true;
                    });
            }

            return { ...input, default: def };
        });

        const data = await inquirer.prompt(prompts);

        Object.assign(this.data, data);

        Object.keys(this.options)
            .forEach((option) => {
                const value = data[option];

                if (typeof value === 'undefined') {
                    return;
                }

                const answers = this.options[option];

                if (!Array.isArray(answers)) {
                    Object.assign(this.data, {
                        [value]: true
                    });
                }
            });
    }

}

Form.NO_YES = NO_YES;
Form.YES_NO = YES_NO;

module.exports = Form;

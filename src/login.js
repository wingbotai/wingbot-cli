/*
 * @author David Menger
 */
'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const api = require('./api');
const credentials = require('./credentials');
const spinAndCatch = require('./cli/spinAndCatch');

async function login () {

    const cfg = credentials.loadData();

    const {
        email, password
    } = await inquirer.prompt([{
        type: 'input',
        message: chalk.cyan(' What is your email? '),
        name: 'email',
        default: cfg.email
    }, {
        type: 'password',
        message: chalk.cyan(' What is your password? '),
        name: 'password',
        mask: '*'
    }]);

    const data = await spinAndCatch(() => api.auth.login(email, password));

    const { token } = data;

    return credentials.saveData({
        ...cfg,
        email,
        token
    });
}

module.exports = login;

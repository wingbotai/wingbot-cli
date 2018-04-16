/*
 * @author David Menger
 */
'use strict';

const api = require('./api');
const credentials = require('./credentials');

function login (email, password) {
    let token = null;
    return api.auth.login(email, password)
        .then((data) => {
            const cfg = credentials.loadData();
            token = data.token; // eslint-disable-line prefer-destructuring
            const newConfig = Object.assign({}, cfg, {
                token
            });
            return credentials.saveData(newConfig);
        })
        .then(() => token);
}

module.exports = login;

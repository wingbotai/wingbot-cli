/*
 * @author David Menger
 */
'use strict';

const api = require('./api');
const credentials = require('./credentials');

function deploy (id, name, token = null) {
    let usetoken = token;
    if (!usetoken) {
        usetoken = credentials.loadData().token;
    }
    return api.deployments.deploy(usetoken, id, name);
}

function list () {
    const token = credentials.loadData();
    return api.deployments.list(token.token);
}

function remove (id) {
    const token = credentials.loadData();
    return api.deployments.remove(token.token, id);
}

module.exports = {
    deploy,
    list,
    remove
};

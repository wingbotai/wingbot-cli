/*
 * @author David Menger
 */
'use strict';

const Auth = require('./Auth');
const config = require('../config');
const Deployments = require('./Deployments');

module.exports = {
    auth: new Auth(config.apiPath),
    deployments: new Deployments(config.apiPath)
};

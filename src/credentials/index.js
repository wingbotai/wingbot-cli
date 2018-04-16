/*
 * @author David Menger
 */
'use strict';

const Store = require('./Store');
const os = require('os');
const path = require('path');

const FOLDER = '.wingbot';
const CONFIG_FILE = 'config.json';

const homeDir = os.homedir();
const deiraFolder = path.join(homeDir, FOLDER);

module.exports = new Store(deiraFolder, CONFIG_FILE);

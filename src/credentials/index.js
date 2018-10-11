/*
 * @author David Menger
 */
'use strict';

const os = require('os');
const path = require('path');
const Store = require('./Store');

const FOLDER = '.wingbot';
const CONFIG_FILE = 'config.json';

const homeDir = os.homedir();
const deiraFolder = path.join(homeDir, FOLDER);

module.exports = new Store(deiraFolder, CONFIG_FILE);

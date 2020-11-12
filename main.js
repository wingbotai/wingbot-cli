/*
 * @author David Menger
 */
'use strict';

const jsonToText = require('./src/textTools/jsonToText');
const EntitiesFromJson = require('./src/textTools/EntitiesFromJson');
const MultiplicatorStream = require('./src/textTools/MultiplicatorStream');
const Pipeline = require('./src/textTools/Pipeline');
const { normalize } = require('./src/textTools/filters');
const TemplateRenderer = require('./src/templateRenderer/TemplateRenderer');
const { preprocessData } = require('./src/init');

module.exports = {
    jsonToText,
    EntitiesFromJson,
    MultiplicatorStream,
    Pipeline,
    normalize,
    TemplateRenderer,
    preprocessData
};

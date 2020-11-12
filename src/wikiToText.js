/*
 * @author David Menger
 */
'use strict';

const xmlNodes = require('xml-nodes');
const xmlObjects = require('xml-objects');
const eventStream = require('event-stream');
const fs = require('fs');
const path = require('path');
const filters = require('./textTools/filters');
const Pipeline = require('./textTools/Pipeline');

async function wikiToText (fromJson, toText) {

    const input = path.resolve(process.cwd(), fromJson);
    const output = path.resolve(process.cwd(), toText);

    let inp;
    let out;
    const map = filters.normalize;

    if (typeof input === 'string') {
        inp = fs.createReadStream(input);
    } else {
        inp = input;
    }

    if (typeof output === 'string') {
        out = fs.createWriteStream(output, { encoding: 'utf8' });
    } else {
        out = output;
    }

    const pipes = new Pipeline();

    pipes.add(inp);

    pipes.add(xmlNodes('page'));

    pipes.add(xmlObjects({
        explicitRoot: false,
        explicitArray: false,
        mergeAttrs: true
    }));

    let cleanText;
    pipes.add(eventStream.mapSync((r) => {
        cleanText = (r.revision.text._ || '')
            .replace(/(<([^>]+)>)/ig, '')
            .replace(/\{\|.+?\|\}/g, '')
            .replace(/[0-9]+(px)?|colspan|rowspan|http:\/\/(www)?|\.(png|svg|jpg|jpeg|html?|gif)/ig, ' ');

        const maptitle = map(r.title);
        return `__label__${maptitle.replace(/\s+/g, '_')} ${maptitle} ${map(cleanText)}\n`;
    }));

    pipes.add(out);

    return pipes.promise();
}

module.exports = wikiToText;

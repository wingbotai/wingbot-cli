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

function average (data) {
    const sum = data.reduce((s, value) => s + value, 0);

    const avg = sum / data.length;
    return avg;
}

function standardDeviation (values, avg) {
    const squareDiffs = values.map((value) => {
        const diff = value - avg;
        const sqrDiff = diff * diff;
        return sqrDiff;
    });

    const avgSquareDiff = average(squareDiffs);

    const stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
}

function showStats (name, what, wordCounts) {
    const min = wordCounts[0];
    const max = wordCounts.length > 0 ? wordCounts[wordCounts.length - 1] : 0;
    const mid = Math.floor(wordCounts.length / 2);
    const median = wordCounts[mid] || 0;

    const avg = average(wordCounts);
    const stddev = standardDeviation(wordCounts, avg);

    // eslint-disable-next-line no-console
    console.log(`\n${name}\n###############`);

    // eslint-disable-next-line no-console
    console.log(`${what} COUNT: ${wordCounts.length}, MIN: ${min}, MAX: ${max}`);
    // eslint-disable-next-line no-console
    console.log(`AVG: ${avg.toFixed(2)}, MEDIAN: ${median.toFixed(2)}, STDDEV: ${stddev.toFixed(2)}`);
}

async function wikiToText (fromWikiXml, toText) {

    const input = path.resolve(process.cwd(), fromWikiXml);
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

    const words = new Map();
    const articleLengths = [];
    const uniqueArticleLengths = [];

    let cleanText;
    pipes.add(eventStream.mapSync((r) => {
        cleanText = (r.revision.text._ || '')
            .replace(/(<([^>]+)>)/ig, '')
            .replace(/\{\|.+?\|\}/g, '')
            .replace(/[0-9]+(px)?|colspan|rowspan|http:\/\/(www)?|\.(png|svg|jpg|jpeg|html?|gif)/ig, ' ');

        const normalized = map(cleanText);

        const splitToWords = normalized.split(/\s+/);

        articleLengths.push(splitToWords.length);
        uniqueArticleLengths.push(new Set(splitToWords).size);

        splitToWords.forEach((w) => {
            const a = words.get(w) || 0;
            words.set(w, a + 1);
        });

        const maptitle = map(r.title);
        return `__label__${maptitle.replace(/\s+/g, '_')} ${maptitle} ${normalized}\n`;
    }));

    pipes.add(out);

    await pipes.promise();

    // show stats
    const wordCounts = Array.from(words.values());

    wordCounts.sort((a, z) => a - z);
    articleLengths.sort((a, z) => a - z);
    uniqueArticleLengths.sort((a, z) => a - z);

    showStats('UNIQUE WORD COUNT IN ARTICLE', 'ARTICLE', uniqueArticleLengths);
    showStats('WORD COUNT IN ARTICLE', 'ARTICLE', articleLengths);
    showStats('WORD COUNTS OVERALL', 'WORD', wordCounts);
}

module.exports = wikiToText;

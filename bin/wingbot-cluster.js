#!/usr/bin/env node
/*
 * @author David Menger
 */
'use strict';

const { replaceDiacritics } = require('webalize');
const fs = require('fs');
const path = require('path');
const { Query } = require('fast-text');
const { DBSCAN, KMEANS } = require('density-clustering');
const commander = require('commander');
const chalk = require('chalk');

const ALG_KM = 'kmeans';
const ALG_DB = 'dbscan';
let source;
let trainingJson;
let userDefinedK;

let algorithm;

commander
    .option('-c, --csv [output]', 'save results to csv file')
    .option('-a, --all', 'include also recognized examples')
    .option('-min [num]', 'minimal number of examples in set (default: 1)')
    .option('--dim <dimensions>', 'vector size (default: 150, lower is faster)')
    .option('--ngrams <ngrams>', 'n-gram size (default: 2)')
    .option('--mincount <mincount>', 'minimal word count (default: 2)')
    .option('-p, --pretrained', 'training file is a pretrained model');

commander.command('kmeans <events.csv> [training.json] [clusters=40]')
    // @ts-ignore
    .description(chalk.blue('Runs clusteing with kmeans alg'))
    .action((ev, tr, k) => {
        // console.log({ ev, tr, k, cmd })
        algorithm = ALG_KM;
        source = ev;
        trainingJson = tr;
        userDefinedK = k && parseFloat(k);
        if (!k && parseFloat(tr) !== Number.NaN) {
            userDefinedK = parseFloat(tr);
        }
    });

commander.command('dbscan <events.csv> [training.json] [distance=14]')
    // @ts-ignore
    .description(chalk.blue('Runs clusteing with dbscan alg'))
    .action((ev, tr, k) => {
        // console.log({ ev, tr, k, cmd })
        algorithm = ALG_DB;
        source = ev;
        trainingJson = tr;
        userDefinedK = k && parseFloat(k);
        if (!k && parseFloat(tr) !== Number.NaN) {
            userDefinedK = parseFloat(tr);
        }
    });

commander
    .command('help')
    // @ts-ignore
    .description(chalk.blue('Prints this message'))
    .action(() => commander.help());


commander.parse(process.argv);

if (!source || !algorithm) {
    commander.help();
    process.exit();
}

const training = [];

if (trainingJson && !commander.pretrained) {
    // eslint-disable-next-line no-console
    console.log('preparing training data from training set...');
    const jsonFileName = path.resolve(process.cwd(), trainingJson);
    const data = fs.readFileSync(jsonFileName, 'utf8');

    const d = JSON.parse(data);

    const map = new Map();

    d.examples.forEach(({ intent, text }) => {
        if (!map.has(intent)) {
            map.set(intent, []);
        }
        map.get(intent)
            .push(replaceDiacritics(`${text}`)
                .toLocaleLowerCase());
    });

    for (const texts of map.values()) {
        training.push(texts.join(' '));
    }
}

const texts = [];
// eslint-disable-next-line no-console
console.log('reading the data...');
const sourceFileName = path.resolve(process.cwd(), source);
const data = fs.readFileSync(sourceFileName, 'utf8');

// eslint-disable-next-line no-console
console.log('cleaning the data...');
// eslint-disable-next-line no-console
console.log(` [${commander.all ? 'will process even recognized intents' : 'will skip recognized intents, use -a to include all'}]`);

const uniques = new Set();

data.split('\n')
    .forEach((l) => {
        const i = l.indexOf(',');

        if (i === -1) {
            return;
        }

        let s = l.substring(0, i);

        if (!s.match(/[a-z]/) || s.match(/[0-9]|@/) || ['Event Label', 'Day Index'].indexOf(s) !== -1) {
            return;
        }

        s = s
            .replace(/^"(.+)\s*"?$/, '$1')
            .replace(/[?!.,]+(\s*)/ig, '$1');

        training.push(s);

        // find the score 112,76,0,0.00
        let [eventCount = '1', score = '0.01'] = l.match(/([0-9]+),[^,]+,[^,0-9]*([0-9.]+)$/) || [];
        // @ts-ignore
        score = parseFloat(score);
        // @ts-ignore
        eventCount = parseInt(eventCount, 10) || 1;

        // @ts-ignore
        if (score <= 0.01 && !commander.all) {
            return;
        }

        if (algorithm === ALG_KM && uniques.has(s)) {
            return;
        }

        if (algorithm === ALG_KM) {
            uniques.add(s);
        }

        const text = { t: s, c: eventCount };

        // @ts-ignore
        if (eventCount > 2 && algorithm !== ALG_KM) {
            texts.push(text, text);
        } else {
            texts.push(text);
        }
    });

let input;
if (commander.pretrained) {
    input = path.resolve(process.cwd(), trainingJson);
} else {
    input = path.resolve(process.cwd(), 'tmp-training.txt');
    // eslint-disable-next-line no-console
    console.log(` [pre-trained model: ${training.length} lines, data for clustering: ${texts.length} lines]`);
    fs.writeFileSync(input, training.join('\n'));
}
const output = path.resolve(process.cwd(), 'tmp-training-out.txt');

const q = new Query(input);

const dim = (commander.dim && parseInt(commander.dim, 10)) || 150;
const wordNgrams = (commander.ngrams && parseInt(commander.ngrams, 10)) || 2;
const minCount = (commander.mincount && parseInt(commander.mincount, 10)) || 2;
const minExamples = (commander.min && parseInt(commander.min, 10)) || 1;

(async function () {
    if (!commander.pretrained) {
        // eslint-disable-next-line no-console
        console.log('training...');
        // eslint-disable-next-line no-console
        console.log(` [ngrams: ${wordNgrams}, mincount: ${minCount}, dim: ${dim}]`);
        await new Promise((resolve, reject) => q.train({
            dim,
            output,
            input,
            epoch: 15,
            bucket: 2000000,
            lr: 0.1,
            minn: 2,
            maxn: 8,
            wordNgrams,
            minCount
        }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        }));
    }


    // eslint-disable-next-line no-console
    console.log('vectoring...');
    const ds = new Array(texts.length);
    for (let k = 0; k < texts.length; k++) {

        // eslint-disable-next-line no-await-in-loop
        const vec = await new Promise((resolve, reject) => {
            q.getSentenceVector(texts[k].t, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
        ds[k] = vec.map(v => v * 100);
    }

    // console.log(ds);
    // calculate the range

    // eslint-disable-next-line no-console
    console.log('clustering...');
    let res;
    let stats = '';
    if (algorithm === ALG_DB) {
        let max = 0;
        let tot = 0;
        let min = 0;
        let z = 0;
        for (; z < ds.length && z < 400; z++) {
            max = Math.max(max, ...ds[z]);
            min = Math.min(min, ...ds[z]);
            tot = ds[z].reduce((t, v) => t + v, tot);
        }

        const dbthreshold = (max - min) / 4.5;
        const eps = userDefinedK || dbthreshold;
        stats = ` [max: ${max}, avg: ${tot / (z * (ds.length ? ds[0].length : 1))}, min: ${min}, recommended: ${dbthreshold}${userDefinedK ? `, used: ${eps}` : ''}]`;
        // eslint-disable-next-line no-console
        console.log(stats);

        // @ts-ignore
        const c = new DBSCAN();
        // const c = new OPTICS(); // 0.005, 2
        res = c.run(ds, eps, 2);
    } else {
        const clstrs = userDefinedK || 40;
        stats = ` [clusters: ${clstrs}]`;
        // eslint-disable-next-line no-console
        console.log(stats);
        // @ts-ignore
        res = (new KMEANS()).run(ds, clstrs);
    }

    // make the stats
    let minCnt = Number.MAX_SAFE_INTEGER;
    let maxCnt = 0;
    let totCnt = 0;
    for (let w = 0; w < res.length; w++) {
        const { length } = res[w];
        minCnt = Math.min(minCnt, length);
        maxCnt = Math.max(maxCnt, length);
        totCnt += length;
    }
    stats += `\n [found clusters: ${res.length}, ITEMS: min: ${minCnt}, max: ${maxCnt}, recognized: ${totCnt}, from: ${texts.length}]`;

    if (minExamples > 1) {
        stats += `\n  (results with less than ${minExamples} was skipped)`;
    }

    // eslint-disable-next-line no-console
    console.log('sorting...');
    /** @type {{t:string,c:number}[][]} */
    const mapped = res.map(items => Object.assign(items.map(i => texts[i]), {
        sum: items.reduce((sum, i) => texts[i].c + sum, 0)
    }));

    // @ts-ignore
    mapped.sort((a, b) => b.sum - a.sum);

    if (!commander.csv) {
        mapped.forEach((items) => {
            // @ts-ignore
            if (items.sum < minExamples) {
                return;
            }
            // @ts-ignore
            console.log(`--------- ${items.sum}:`); //  eslint-disable-line no-console
            // eslint-disable-next-line no-console
            console.log(items
                .map((r) => {
                    const { t } = r;
                    if (t.length > 200) {
                        return `${t.substring(0, 200).trim()}...`;
                    }
                    return t.trim();
                })
                .join(', '));
        });

        // eslint-disable-next-line no-console
        console.log('============');
        // eslint-disable-next-line no-console
        console.log(stats);
        return;
    }

    const csv = mapped
        // @ts-ignore
        .filter(items => items.sum >= minExamples)
        .map(items => items
            .map(r => r.t.replace(/[,\s]+/g, ' '))
            .join(','))
        .join('\n');

    if (commander.csv === true) {
        // eslint-disable-next-line no-console
        console.log(csv);
        return;
    }

    const toFile = path.resolve(process.cwd(), commander.csv);
    // eslint-disable-next-line no-console
    console.log(`writing results to ${toFile}`);
    // eslint-disable-next-line no-console
    console.log('============');
    // eslint-disable-next-line no-console
    console.log(stats);
    fs.writeFileSync(toFile, csv);

}())
    .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exit(-1);
    });

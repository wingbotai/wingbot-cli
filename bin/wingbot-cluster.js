#!/usr/bin/env node
/*
 * @author David Menger
 */
'use strict';

const { replaceDiacritics } = require('webalize');
const fs = require('fs');
const path = require('path');
const { DBSCAN, KMEANS } = require('density-clustering');
const commander = require('commander');
const chalk = require('chalk');

const ALG_KM = 'kmeans';
const ALG_DB = 'dbscan';
let source;
let trainingJson;
let userDefinedK;

let algorithm;

let Query;

try {
    ({ Query } = module.require('fast-text'));
} catch (e) {
    Query = null;
}

const DEFAULT_CLUSTERS = 100;
const DEFAULT_MINCOUNT = 2;

commander
    .option('-c, --csv [output]', 'save results to csv file')
    .option('-a, --all', 'include also recognized examples')
    .option('--min [num]', 'minimal number of examples in set (default: 1)')
    .option('--minunique <num>', 'minimal number of examples in set (default: 1)')
    .option('--dim <dimensions>', 'vector size (default: 150, lower is faster)')
    .option('--ngrams <ngrams>', 'n-gram size (default: 2)')
    .option('--mincount <mincount>', `minimal word count in utterance (default: ${DEFAULT_MINCOUNT})`)
    .option('-p, --pretrained', '[intentsExport.json] is a pre-trained fasttext model')
    .option('-r, --replace <replace...>', '"phrase to replace" to remove additional texts');

commander.command(`kmeans <analyticsEvents.csv> [intentsExport.json] [clusters=${DEFAULT_CLUSTERS}]`)
    // @ts-ignore
    .description(chalk.blue('Runs clusteing with kmeans alg'))
    .action((ev, tr, k) => {
        // console.log({ ev, tr, k, cmd })
        algorithm = ALG_KM;
        source = ev;
        trainingJson = tr;
        userDefinedK = k && parseFloat(k);
        if (!k && !Number.isNaN(parseFloat(tr))) {
            userDefinedK = parseFloat(tr);
        }
    });

commander.command('dbscan <analyticsEvents.csv> [intentsExport.json] [distance=14]')
    // @ts-ignore
    .description(chalk.blue('Runs clusteing with dbscan alg'))
    .action((ev, tr, k) => {
        // console.log({ ev, tr, k, cmd })
        algorithm = ALG_DB;
        source = ev;
        trainingJson = tr;
        userDefinedK = k && parseFloat(k);
        if (!k && !Number.isNaN(parseFloat(tr))) {
            userDefinedK = parseFloat(tr);
        }
    });

commander
    .command('help')
    // @ts-ignore
    .description(chalk.blue('Prints this message'))
    .action(() => commander.help());

commander.parse(process.argv);

const options = commander.opts();
// eslint-disable-next-line no-console
console.log(options);

if (!source || !algorithm) {
    commander.help();
    process.exit();
}

if (!Query) {
    // eslint-disable-next-line no-console
    console.log('This machine does not support clustering');
    process.exit();
}

const training = [];

if (trainingJson && !options.pretrained) {
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

const uniques = new Set();

const minUniqueEvents = (options.minunique && parseInt(options.minunique, 10)) || 1;

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
            .replace(/[?!.,]+(\s*)/ig, '$1')
            .replace(/[^A-Za-z0-9]+/g, ' ')
            .trim();

        s = (options.replace || [])
            .reduce((str, replacement) => `${str}`.replace(new RegExp(replacement.toLocaleLowerCase(), 'g'), ''), s)
            .replace(/\s[\s]+/g, ' ')
            .trim();

        if (!s) {
            return;
        }

        training.push(s);

        // find the score 112,76,0,0.00
        // Total Events,Unique Events,Event Value,Avg. Value
        let [, eventCount = '1', uniqueEvents = '1', score = '0.01'] = l.match(/([0-9]+),[^,0-9]*([0-9]+)[^,0-9]*,[^,0-9]*([0-9.]+)$/) || [];
        // @ts-ignore
        score = parseFloat(score);
        // @ts-ignore
        eventCount = parseInt(eventCount, 10) || 1;
        uniqueEvents = parseInt(uniqueEvents, 10) || 1;

        // @ts-ignore
        // if (score <= 0.01 && !options.all) {
        //     return;
        // }

        if (uniqueEvents < minUniqueEvents) {
            return;
        }

        if (algorithm === ALG_KM && uniques.has(s)) {
            return;
        }

        if (algorithm === ALG_KM) {
            uniques.add(s);
        }

        const text = { t: s, s: score, c: eventCount };

        // @ts-ignore
        if (eventCount > 2 && algorithm !== ALG_KM) {
            texts.push(text, text);
        } else {
            texts.push(text);
        }
    });

let input;
if (options.pretrained) {
    input = path.resolve(process.cwd(), trainingJson);
} else {
    input = path.resolve(process.cwd(), 'tmp-training.txt');
    // eslint-disable-next-line no-console
    console.log(` [pre-trained model: ${training.length} lines, data for clustering: ${texts.length} lines]`);
    fs.writeFileSync(input, training.join('\n'));
}
const output = path.resolve(process.cwd(), 'tmp-training-out.txt');

const q = new Query(input);

const dim = (options.dim && parseInt(options.dim, 10)) || 150;
const wordNgrams = (options.ngrams && parseInt(options.ngrams, 10)) || 2;
const minCount = (options.mincount && parseInt(options.mincount, 10)) || DEFAULT_MINCOUNT;
const minExamples = (options.min && parseInt(options.min, 10)) || 1;

(async function () {
    if (!options.pretrained) {
        // eslint-disable-next-line no-console
        console.log('training...');
        // eslint-disable-next-line no-console
        console.log(` [ngrams: ${wordNgrams}, mincount: ${minCount}, dim: ${dim}]`);
        await new Promise((resolve, reject) => {
            q.train({
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
            });
        });
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
        ds[k] = vec.map((v) => v * 100);
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
        const clstrs = userDefinedK || DEFAULT_CLUSTERS;
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
    const mapped = res.map((items) => Object.assign(items.map((i) => texts[i]), {
        sum: items.reduce((sum, i) => (texts[i].c * texts[i].s) + sum, 0),
        cnt: items.reduce((sum, i) => texts[i].c + sum, 0)
    }));

    // @ts-ignore
    mapped.sort((a, b) => b.sum - a.sum);

    if (!options.csv) {
        mapped.forEach((raw) => {
            const items = raw
                .filter((r) => options.all || r.s >= 0.5);

            // @ts-ignore
            if (items.length < minExamples) {
                console.log(` - skip ${raw.cnt} (${raw.sum.toFixed(0)}):`); //  eslint-disable-line no-console
                return;
            }
            // @ts-ignore
            console.log(`--------- ${raw.cnt} (${((raw.sum / raw.cnt) * 100).toFixed(0)}%):`); //  eslint-disable-line no-console
            // eslint-disable-next-line no-console
            console.log(items
                .sort((a, z) => z.s - a.s)
                .map((r) => {
                    const lenLim = r.s < 0.5 ? 100 : 200;
                    let { t } = r;

                    if (t.length > lenLim) {
                        t = `${r.s < 0.75 ? '*' : ''}${t.substring(0, lenLim).trim()}...`;
                    } else {
                        t = t.trim();
                    }
                    return `${r.s < 0.75 ? '*' : ''}${t}`;
                })
                .join(', '));
        });

        // eslint-disable-next-line no-console
        console.log('========================================================\n *) Avg. Event Value < 0.75 - probably recognized utterance\n');

        // eslint-disable-next-line no-console
        console.log(` [${options.all ? 'all utterances shown, omit -a to hide the recognized texts' : 'skipped recognized utterances, use -a to show all'}]`);
        // eslint-disable-next-line no-console
        console.log(stats);
        return;
    }

    const csv = mapped
        // @ts-ignore
        .filter((items) => items.cnt >= minExamples)
        .map((items) => items
            .map((r) => r.t.replace(/[,\s]+/g, ' '))
            .join(','))
        .join('\n');

    if (options.csv === true) {
        // eslint-disable-next-line no-console
        console.log(csv);
        return;
    }

    const toFile = path.resolve(process.cwd(), options.csv);
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

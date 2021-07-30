/**
 * @author Ales Kalfas
 */
'use strict';

const { default: xlsx } = require('node-xlsx');
const fs = require('fs');
const log = require('../../lib/log');
const stateToResult = require('../../lib/surveyOutput/stateToResult');
const resultToExport = require('../../lib/surveyOutput/resultToExport');
const exportsToXlsx = require('./transformations/exportsToXlsx');
const mongodb = require('../../lib/mongodb');
const { db: dbConfig, environment } = require('../../config');

const dateToString = (date) => {
    const iso = date.toISOString();
    const res = iso.replace(/[^\dT]/g, '');
    return res;
};

/**
 * The shortest way to export state to excel
 */
const run = async () => {
    log.log('////////////////////////////////////////////////////////////////////////////////////////////////////');
    log.log('// Export state to excel ');
    log.log('////////////////////////////////////////////////////////////////////////////////////////////////////');
    log.log('Establishing connection to DB...');
    log.log(`${JSON.stringify(dbConfig, null, '\t')}`);
    const db = await mongodb();
    const states = await db.collection('states');
    log.log('>>> DB CONNECTED <<<');

    log.log('Finding states with completed psychodiagnosti part...');
    const foundStates = await states.find({
        'state.replies': {
            $elemMatch: {
                category: 'predikce',
                id: 'spokojenostVPraci'
            }
        },
        'state.Email': { $exists: true, $ne: null }
    }).toArray();
    log.log(`>>> Found ${foundStates.length} states <<<`);
    // Transform states to result
    log.log('Start transform states to results...');
    const results = foundStates
        .map((state) => stateToResult(state.pageId, state.senderId, state.state));
    log.log(`>>> Transformed to ${results.length} <<<`);
    // Transform results to exports
    log.log('Start transform results to exports...');
    const exports = results.map(resultToExport);
    log.log(`>>> Transformed to ${exports.length} <<<`);
    // Transform exports to XLSX
    log.log('Start transform exports to XLSX...');
    const fileName = `export_${environment}-${dateToString(new Date())}.xlsx`;
    const additionalInfo = {
        environment,
        fileName
    };
    const xlsxData = exportsToXlsx(exports, additionalInfo);
    log.log('>>> XLSX Transformed <<<');
    // Create xls
    log.log('Start creating XLSX file...');
    log.log(`\t file name: ${fileName}`);

    const buffer = xlsx.build(xlsxData);
    // @ts-ignore
    fs.writeFileSync(fileName, buffer);
    log.log('>>> File created <<<');

    process.exit();
};

Promise.resolve(run());

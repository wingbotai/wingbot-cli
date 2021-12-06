/*
 * @author David Menger
 */
'use strict';

// const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { TemplateRenderer } = require('../src/templateRenderer');
const { options, preprocessData } = require('../src/init');

const isWin = process.platform === 'win32';

const defaultData = {
    mssqlName: 'clitest',
    wingbotBotName: 'wingbot-cli-test',
    wingbotBotId: '230abe59-565c-4dd1-ae02-119a71b1ae51',
    wingbotDevelopmentToken: 'Izo88ZlCWgRQmqBDZHpcEYfE9TGtwVJJ3U5lmhaZMYbF4gICKhBu9buVTCtsIbwykfXzJPuaFMD28n7iezz69jUpSIgcrkAIucDUkHektkDCGNcOkept5XSMCpI7B6P8',
    bsBotSku: 'F0'
};

const useOptions = { ...options };

delete useOptions.bsBotSku;
delete useOptions.database['Azure Cosmos DB (MongoDB protocol)'];
// delete useOptions.infrastructure['Express application'];
// delete useOptions.infrastructure['Serverless AWS'];
// delete useOptions.infrastructure['Azure Web Apps'];
// delete useOptions.infrastructure['Azure Functions'];

// delete useOptions.platform['Facebook Messenger'];
// delete useOptions.platform['Azure Bot Service'];
// delete useOptions.platform.Webchat;

const skipOptions = [
    { azureExpress: true, dynamodbStorage: true },
    { express: true, dynamodbStorage: true },
    { azureServerless: true, dynamodbStorage: true },
    { botService: true, fbLoadProfile: true },
    { keyvault: true, express: true },
    { keyvault: true, awsServerless: true },
    { appInsights: true, express: true },
    { appInsights: true, awsServerless: true },
    { wingbot: true, fbLoadProfile: true },
    { storeConversationHistory: true, sentry: true },
    { storeConversationHistory: true, appInsights: true },
    { dbTokenStorage: true, sentry: true },
    { dbTokenStorage: true, appInsights: true },
    { jwtTokenStorage: true, sentry: true },
    { jwtTokenStorage: true, appInsights: true },
    { keyvault: true, sentry: true },
    { keyvault: true, appInsights: true },
    { conversationTesting: true, sentry: true },
    { conversationTesting: true, appInsights: true },
    { conversationTesting: true, fbLoadProfile: true },
    { storeConversationHistory: true, dbTokenStorage: true },
    { storeConversationHistory: true, jwtTokenStorage: true },
    { storeConversationHistory: true, jwtTokenStorage: true },
    { storeConversationHistory: true, fbLoadProfile: true },
    { sentry: true, fbLoadProfile: true },
    { sentry: true, fbLoadProfile: true },
    { appInsights: true, fbLoadProfile: true },
    { wingbotOrchestrator: true, fbLoadProfile: true }
];

let prevousCwd;

function rmdir (dir) {
    return new Promise((resolve) => {
        exec(`${isWin ? 'rd /s /q' : 'rm -rf'} ${dir}`, (err, stdout) => {
            resolve(stdout);
        });
    });
}

function reuseNodeModules (cwd) {
    if (!prevousCwd) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        exec(`${isWin ? 'move' : 'mv'} ${prevousCwd}/node_modules ${cwd}/`, (err, stdout, stderr) => {

            if (err) {
                // node couldn't execute the command

                console.log(`stdout: ${stdout}`); // eslint-disable-line
                console.log(`stderr: ${stderr}`); // eslint-disable-line

                reject(err);
                return;
            }

            // the *entire* stdout and stderr (buffered)
            resolve();
        });
    });
}

function npmI (cwd) {
    return new Promise((resolve) => {
        exec('npm i', {
            cwd
        }, (err, stdout) => {
            prevousCwd = cwd;
            // console.log('-----', stdout); // eslint-disable-line
            // console.log('-----', stderr); // eslint-disable-line
            resolve(stdout);
        });
    });
}

function test (cwd) {
    return new Promise((resolve, reject) => {
        exec('npm test', {
            cwd
        }, (err, stdout, stderr) => {

            if (err) {
                console.log(`stdout: ${stdout}`); // eslint-disable-line
                console.log(`stderr: ${stderr}`); // eslint-disable-line
                // node couldn't execute the command
                reject(err);
                return;
            }

            // the *entire* stdout and stderr (buffered)
            resolve(stdout);
        });
    });
}

function isSkipped (config) {
    return skipOptions
        .some((opts) => Object.keys(opts)
            .every((key) => config[key]));
}

function generateTests (keysStack = Object.keys(useOptions).reverse()) {
    const [key] = keysStack;
    const nextStack = keysStack.slice(1);

    let ret;
    if (nextStack.length === 0) {
        ret = [{
            testrun: true,
            _testName: '',
            _opts: 't',
            _x: [],
            ...defaultData
        }];
    } else {
        ret = generateTests(nextStack);
    }

    if (Array.isArray(options[key])) {
        // boolean
        return ret.reduce((arr, option) => {
            arr.push(...[true, false]
                .map((variant) => ({
                    ...option,
                    _testName: `${option._testName}${variant ? `, ${key}` : ''}`,
                    _x: [...option._x, { variant, key }],
                    _opts: `${option._opts}${variant ? `-${key.substr(0, 9)}` : ''}`,
                    [key]: variant
                }))
                .filter((newOption) => !isSkipped(newOption)));
            return arr;
        }, []);
    }

    return ret.reduce((arr, option) => {
        const variants = options[key];
        const newOptions = Object.keys(variants)
            .map((variant) => ({
                ...option,
                _testName: `${option._testName}, ${variant}`,
                _x: [...option._x, { v: `${variants[variant]}`, variant }],
                _opts: `${option._opts}${variants[variant] ? `-${variants[variant]}`.substr(0, 10) : ''}`,
                [key]: variants[variant],
                [variants[variant]]: true
            }))
            .filter((newOption) => !isSkipped(newOption));

        arr.push(...newOptions);
        return arr;
    }, []);
}

const tempDir = path.resolve(__dirname, path.join('..', 'temp'));
const templateRoot = path.resolve(__dirname, path.join('..', 'templates'));

describe('$ init', function () {

    this.timeout(0);

    const tests = generateTests();

    console.log(`## TOTALLY: ${tests.length} TESTS`); // eslint-disable-line no-console

    tests.forEach((t) => {

        it(t._testName.substr(2), async () => {
            const data = preprocessData(t); // eslint-disable-line

            console.log(`    temp/${data._opts}`); // eslint-disable-line no-console

            const botDir = path.join(tempDir, data._opts);

            try {
                fs.rmdirSync(botDir);
            } catch (e) {
                // mute
            }

            const tr = new TemplateRenderer(templateRoot, botDir, data);

            await tr.render();
            await rmdir(path.join(botDir, 'node_modules'));
            await reuseNodeModules(botDir);
            await npmI(botDir);
            await test(botDir);
        });

    });

});

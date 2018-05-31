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

const defaultData = {
    wingbotBotName: 'wingbot-cli-test',
    wingbotBotId: '230abe59-565c-4dd1-ae02-119a71b1ae51',
    wingbotDevelopmentToken: 'Izo88ZlCWgRQmqBDZHpcEYfE9TGtwVJJ3U5lmhaZMYbF4gICKhBu9buVTCtsIbwykfXzJPuaFMD28n7iezz69jUpSIgcrkAIucDUkHektkDCGNcOkept5XSMCpI7B6P8',
    bsBotSku: 'F0'
};

const useOptions = Object.assign({}, options);

delete useOptions.bsBotSku;

const skipOptions = [
    { azureExpress: true, dynamodbStorage: true },
    { azureServerless: true, dynamodbStorage: true }
];

let prevousCwd;

function reuseNodeModules (cwd) {
    if (!prevousCwd) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        exec(`mv ${prevousCwd}/node_modules ${cwd}/`, (err, stdout, stderr) => {

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

function test (cwd) {
    return new Promise((resolve, reject) => {
        exec('npm i && npm test', {
            cwd
        }, (err, stdout, stderr) => {
            console.log(`stdout: ${stdout}`); // eslint-disable-line
            console.log(`stderr: ${stderr}`); // eslint-disable-line

            if (err) {
                // node couldn't execute the command
                reject(err);
                return;
            }

            prevousCwd = cwd;

            // the *entire* stdout and stderr (buffered)
            resolve(stdout);
        });
    });
}

function isSkipped (config) {
    return skipOptions
        .some(opts => Object.keys(opts)
            .every(key => config[key]));
}

function generateTests (keysStack = Object.keys(useOptions).reverse()) {
    const [key] = keysStack;
    const nextStack = keysStack.slice(1);

    let ret;
    if (nextStack.length === 0) {
        ret = [Object.assign({
            _testName: '',
            _opts: ''
        }, defaultData)];
    } else {
        ret = generateTests(nextStack);
    }

    if (Array.isArray(options[key])) {
        // boolean
        return ret.reduce((arr, option) => {
            arr.push(...[true, false]
                .map(variant => Object.assign({}, option, {
                    _testName: `${option._testName}${variant ? `, ${key}` : ''}`,
                    _opts: `${variant ? `-${option._opts}${key.substr(0, 5)}` : ''}`,
                    [key]: variant
                }))
                .filter(newOption => !isSkipped(newOption)));
            return arr;
        }, []);
    }

    return ret.reduce((arr, option) => {
        const variants = options[key];
        const newOptions = Object.keys(variants)
            .map(variant => Object.assign({}, option, {
                _testName: `${option._testName}, ${variant}`,
                _opts: `${option._opts}${variants[variant] ? `-${variants[variant].substr(0, 5)}` : ''}`,
                [key]: variants[variant],
                [variants[variant]]: true
            }))
            .filter(newOption => !isSkipped(newOption));

        arr.push(...newOptions);
        return arr;
    }, []);
}

const tempDir = path.resolve(__dirname, path.join('..', 'temp'));
const templateRoot = path.resolve(__dirname, path.join('..', 'templates'));

describe.only('$ init', () => {

    generateTests()
        .forEach((t) => {

            it(t._testName.substr(2), async () => {
                const data = preprocessData(t); // eslint-disable-line

                const botDir = path.join(tempDir, data._opts);

                try {
                    fs.rmdirSync(botDir);
                } catch (e) {
                    // mute
                }

                const tr = new TemplateRenderer(templateRoot, botDir, data);

                await tr.render();

                await reuseNodeModules(botDir);
                await test(botDir);

                fs.rmdirSync(botDir);
            });

        });

});

/*
 * @author David Menger
 */
'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const spinAndCatch = require('./cli/spinAndCatch');
const { TemplateRenderer } = require('./templateRenderer');

const { log } = console;

const SERVERLESS_AWS = 'awsServerless';
const EXPRESS = 'express';
const EXPRESS_AZURE = 'azureExpress';
const SERVERLESS_AZURE = 'azureServerless';

const MESSENGER = 'messenger';
const BOT_SERVICE = 'botService';

const AWS_DYNAMO_DB = 'dynamodbStorage';
const MONGODB = 'mongodbStorage';
const AZURE_COSMOS_DB = 'cosmosdbStorage';
// const MEMORY_STORAGE = 'memoryStorage';

const DB_TOKEN_STORAGE = 'dbTokenStorage';
const JWT_TOKEN_STORAGE = 'jwtTokenStorage';

const frontendTokenStorages = {
    'No frontend token storage': null,
    'JWT token storage': JWT_TOKEN_STORAGE,
    'Use database as token storage': DB_TOKEN_STORAGE
};

const infrastructures = {
    'Express application': EXPRESS,
    'Serverless AWS': SERVERLESS_AWS,
    'Azure Functions': SERVERLESS_AZURE,
    'Azure App Service': EXPRESS_AZURE
};

const platforms = {
    'Facebook messenger': MESSENGER,
    'Azure Bot Service': BOT_SERVICE
};

const databases = {
    MongoDB: MONGODB,
    'AWS DynamoDB': AWS_DYNAMO_DB,
    'Azure Cosmos DB (MongoDB protocol)': AZURE_COSMOS_DB
};

const analytics = {
    None: null,
    'Universal Analytics': 'googleAnalytics'
};

const bsBotSkus = {
    'F0 (Free)': 'F0',
    'S1 (Standard)': 'S1'
};

const defaults = {
    eslint: true
};

function randomString () {
    const hash = crypto.createHash('sha1');
    hash.update(`${Math.random()}${Date.now()}`);
    return hash.digest('hex');
}

function usePreviousValues (prompt, previousData) {
    return prompt.map((input) => {
        if (typeof previousData[input.name] === 'undefined') {
            return input;
        }

        let def = previousData[input.name];

        if (typeof def === 'boolean') {
            def = def
                ? 'Yes'
                : 'No';
        }

        return Object.assign({}, input, {
            default: def
        });
    });
}


function group (header, paragraph, textLabel) {
    return `\n${chalk.bold.green(header)}\n${'-'.repeat(header.length)}\n${chalk.gray(paragraph)}\n\n${chalk.green('?')} ${textLabel}`;
}

function label (title, description = null, optional = false) {
    const color = optional ? 'cyan' : 'cyan';
    let ret = chalk[color].bold(` ${title} `);
    if (description) {
        ret += `\n    ${optional ? chalk.white('(optional) ') : ''}${chalk.gray(`${description} `)}`;
    }
    return ret;
}

module.exports = async function init () {


    const inputsStorage = path.resolve(process.cwd(), '.wingbot');
    let previousData;
    try {
        const data = fs.readFileSync(inputsStorage, { encoding: 'utf8' });
        previousData = JSON.parse(data);
    } catch (e) {
        previousData = {};
    }

    const data = Object.assign({}, defaults);
    const destination = process.cwd();
    const rememberData = {};
    let res;

    data.jwtTokenSecret = previousData.jwtTokenSecret || randomString();

    res = await inquirer.prompt(usePreviousValues([
        {
            type: 'input',
            name: 'projectName',
            message: group(
                'Project settings',
                'We have to set up the basics: name, desired infrastructure, database and messaging platform',
                label('Choose a name for your project')
            ),
            default: path.basename(destination)
        },
        {
            type: 'list',
            name: 'infrastructure',
            message: label('Choose a deployment infrastructure'),
            choices: Object.keys(infrastructures)
        },
        {
            type: 'list',
            name: 'platform',
            message: label('Choose a messaging platform '),
            choices: Object.keys(platforms)
        },
        {
            type: 'list',
            name: 'database',
            message: label('Choose a database'),
            choices: Object.keys(databases)
        },
        {
            type: 'list',
            name: 'analytic',
            message: label('Choose an analytic tool'),
            choices: Object.keys(analytics)
        },
        {
            type: 'list',
            name: 'withoutDesigner',
            message: label('Use without wingbot.ai chatbot designer', 'for experimental purposes you can omit designer connection'),
            choices: ['No', 'Yes'],
            filter: choice => choice === 'Yes'
        }
    ], previousData));

    Object.assign(rememberData, res);

    const {
        projectName,
        infrastructure,
        platform,
        database,
        analytic
    } = res;

    const projName = projectName;
    const infr = infrastructures[infrastructure];
    const platf = platforms[platform];
    const db = databases[database];
    const anal = analytics[analytic];

    Object.assign(data, res, {
        [infr]: true,
        [platf]: true,
        [db]: true,
        [anal]: true,
        projectName: projName,
        infrastructure: infr,
        database: db,
        analytics: anal,
        platform: platf
    });

    if (!data.withoutDesigner) {
        res = await inquirer.prompt(usePreviousValues([
            {
                type: 'input',
                name: 'wingbotBotName',
                message: group(
                    'Wingbot settings',
                    'We need to know wingbot connection data for every environment.\nBut you can skip these steps and fill these data later.\nYou can find all requested informations in "deployments" settings of your chatbot.',
                    label('Wingbot bot name', 'you can fill it later into config/index.js', true)
                ),
                default: path.basename(destination)
            },
            {
                type: 'input',
                name: 'wingbotBotId',
                message: label('Wingbot bot ID', 'you can fill it later into config/index.js', true)
            },
            {
                type: 'input',
                name: 'wingbotDevelopmentToken',
                message: label('Wingbot "development" snapshot token', 'you can fill it later into config/index.js', true)
            },
            {
                type: 'input',
                name: 'wingbotProductionToken',
                message: label('Wingbot "production" snapshot token', 'you can fill it later into config/config.production.js', true)
            }
        ], previousData));

        Object.assign(rememberData, res);
        Object.assign(data, res);
    }

    switch (data.database) {
        case AWS_DYNAMO_DB:
        case MONGODB:
        case AZURE_COSMOS_DB: {
            res = await inquirer.prompt(usePreviousValues([
                {
                    type: 'list',
                    message: label('Store conversation history in DB', 'not necessary for running a chatbot', true),
                    name: 'storeConversationHistory',
                    choices: ['No', 'Yes'],
                    filter: choice => choice === 'Yes'
                },
                {
                    type: 'list',
                    message: label('Choose a frontend token storage', 'usefull for authorizing webviews', true),
                    name: 'fts',
                    choices: Object.keys(frontendTokenStorages)
                }
            ], previousData));

            const { fts } = res;
            const frontendTokenStorage = frontendTokenStorages[fts];
            Object.assign(res, {
                frontendTokenStorage,
                [frontendTokenStorage]: true
            });

            break;
        }
        default:
            res = {
                storeConversationHistory: false
            };
            break;
    }
    Object.assign(rememberData, res);
    Object.assign(data, res);

    switch (data.database) {
        case MONGODB: {
            res = await inquirer.prompt(usePreviousValues([
                {
                    type: 'input',
                    message: group(
                        'MongoDB connection',
                        'you can fill theese data later into config files, but it\'s recommended to keep connection string in ENV variables',
                        label('Database name')
                    ),
                    name: 'mongodbName'
                },
                {
                    type: 'input',
                    message: label('Connection string', 'for production environment', true),
                    name: 'mongodbConnectionString'
                }
            ], previousData));

            break;
        }
        case AZURE_COSMOS_DB: {
            res = await inquirer.prompt(usePreviousValues([
                {
                    type: 'input',
                    message: group(
                        'Cosmos DB connection',
                        'you can fill this information later into config files, but it\'s recommended to keep connection string in ENV variable (COSMOSDB_CONNECTION_STRING)',
                        label('Database name (wil be created if not existing)')
                    ),
                    name: 'cosmosdbName'
                },
                {
                    type: 'input',
                    message: label('Connection string', 'for production environment', true),
                    name: 'cosmosdbConnectionString'
                }
            ], previousData));

            break;
        }
        case AWS_DYNAMO_DB:
        default:
            break;
    }
    Object.assign(rememberData, res);
    Object.assign(data, res);

    switch (data.platform) {
        case MESSENGER:
            res = await inquirer.prompt(usePreviousValues([
                {
                    type: 'input',
                    message: group(
                        'FB Messanger platform settings',
                        'Each FB bot needs a FB application in http://developers.facebook.com.\nYou will be able to edit these data later in config directory.',
                        label('Facebook App ID', 'you can find it at FB developers portal', true)
                    ),
                    name: 'fbAppId'
                },
                {
                    type: 'input',
                    message: label('Facebook Page ID', 'you can find it at settings of the desired FB page', true),
                    name: 'fbPageId'
                },
                {
                    type: 'input',
                    message: label('Facebook App Secret', 'you can find it at FB developers portal', true),
                    name: 'fbAppSecret'
                },
                {
                    type: 'input',
                    message: label('Facebook Page Token', 'you can generate it at FB developers portal, messenger section of your application', true),
                    name: 'fbPageToken'
                },
                {
                    type: 'input',
                    message: label('Facebook Bot Token', 'the random string, you can use for attaching a webhook', true),
                    name: 'fbBotToken',
                    default: randomString()
                },
                {
                    type: 'list',
                    message: label('Download profile data, when starting conversation', 'user profile data will be stored in chatbots state', true),
                    name: 'fbLoadProfile',
                    choices: ['No', 'Yes'],
                    filter: choice => choice === 'Yes'
                }
            ], previousData));
            break;
        case BOT_SERVICE:
            res = await inquirer.prompt(usePreviousValues([
                {
                    type: 'input',
                    message: group(
                        'Bot Service settings',
                        'Each Bot Service bot needs to have a corresponding app registered with Microsoft.\nRegister your bot at https://aka.ms/msaappid and use Application Id and Password here.',
                        label('Bot name (handle)', 'Global bot identification, must be unique')
                    ),
                    name: 'bsBotName',
                    default: path.basename(destination)
                }
            ], previousData));

            Object.assign(rememberData, res);

            res = await inquirer.prompt(usePreviousValues([
                {
                    type: 'input',
                    message: label('Bot display name', 'This name is shown to users on most channels'),
                    name: 'bsBotDisplayName',
                    default: rememberData.bsBotName
                },
                {
                    type: 'input',
                    message: label('Bot Application Id', 'Microsoft App Id or Client ID of your bot application. You can set it later in config or ENV variable BOT_APP_ID', true),
                    name: 'bsAppId'
                },
                {
                    type: 'input',
                    message: label('Bot Application Password', 'Microsoft App Password or Client Secret of your bot application. You can set it later in config or ENV variable BOT_APP_PASSWORD', true),
                    name: 'bsAppPassword'
                },
                {
                    type: 'list',
                    message: label('Bot SKU', 'SKU defines price and performance of your Bot Service. Choose F0 for development and switch to S1 for production'),
                    name: 'bsBotSku',
                    choices: Object.keys(bsBotSkus),
                    default: 'F0'
                }
            ], previousData));
            break;
        default:
            break;
    }

    Object.assign(rememberData, res);
    Object.assign(data, res, {
        bsBotSku: bsBotSkus[res.bsBotSku]
    });

    switch (data.infrastructure) {
        case SERVERLESS_AWS:
            res = await inquirer.prompt(usePreviousValues([
                {
                    type: 'input',
                    message: group(
                        'AWS Deployment settings',
                        'We will prepare a serverless.yml file, where you will be able to edit these data later',
                        label('Your AWS Account ID')
                    ),
                    name: 'awsAccountId',
                    default: process.env.AWS_ACCOUNT_ID
                },
                {
                    type: 'awsRegion',
                    message: label('Your AWS Region'),
                    name: 'awsRegion',
                    default: 'eu-central-1'
                }
            ], previousData));
            break;
        case SERVERLESS_AZURE:
            res = await inquirer.prompt(usePreviousValues([
                {
                    type: 'input',
                    message: group(
                        'Azure Functions deployment settings',
                        'We will prepare an ARM template where you will be able to edit this information later',
                        label('Resource Group name')
                    ),
                    name: 'azureRgName',
                    default: `${rememberData.bsBotName}-rg`
                },
                {
                    type: 'input',
                    message: label('Function App name'),
                    name: 'azureFunctionAppName',
                    default: rememberData.bsBotName
                }
            ], previousData));
            break;
        case EXPRESS_AZURE:
        case EXPRESS:
        default:
            break;
    }

    Object.assign(rememberData, res);
    Object.assign(data, res);

    if (data.googleAnalytics) {
        res = await inquirer.prompt(usePreviousValues([
            {
                type: 'input',
                message: group(
                    'Analytics settings',
                    'we will configure Google Analytics for your production environment',
                    label('Your Universal Analytics tracking ID')
                ),
                name: 'gaCode'
            }
        ], previousData));


        Object.assign(rememberData, res);
        Object.assign(data, res);
    }


    try {
        fs.writeFileSync(inputsStorage, JSON.stringify(rememberData));
    } catch (e) {
        // noop
    }
    const root = path.resolve(__dirname, path.join('..', 'templates'));

    Object.assign(data, {
        isMongoOrCosmos: data[MONGODB] || data[AZURE_COSMOS_DB],
        isAwsOrAzure: data[SERVERLESS_AWS] || data[SERVERLESS_AZURE]
    });

    const tr = new TemplateRenderer(root, destination, data);

    await spinAndCatch(() => tr.render());

    log(`\n${chalk.green.bold('Your project is ready!')}\n\n${chalk.white('do not forget to run')} ${chalk.magenta('npm install')}`);

    switch (data.infrastructure) {
        case SERVERLESS_AWS:
            log(`${chalk.white('for deployment use')} ${chalk.magenta('npm run deploy:production')}`);
            break;
        default:
            break;
    }
};

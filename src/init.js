/*
 * @author David Menger
 */
'use strict';

const path = require('path');
const chalk = require('chalk');
const fs = require('fs');
const spinAndCatch = require('./cli/spinAndCatch');
const Form = require('./Form');
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

const DB_TOKEN_STORAGE = 'dbTokenStorage';
const JWT_TOKEN_STORAGE = 'jwtTokenStorage';

const options = {
    infrastructure: {
        'Express application': EXPRESS,
        'Serverless AWS': SERVERLESS_AWS,
        'Azure Functions': SERVERLESS_AZURE,
        'Azure App Service': EXPRESS_AZURE
    },
    platform: {
        'Facebook messenger': MESSENGER,
        'Azure Bot Service': BOT_SERVICE
    },
    database: {
        MongoDB: MONGODB,
        'AWS DynamoDB': AWS_DYNAMO_DB,
        'Azure Cosmos DB (MongoDB protocol)': AZURE_COSMOS_DB
    },
    analytics: {
        None: null,
        'Universal Analytics': 'googleAnalytics'
    },
    frontendTokenStorage: {
        'No frontend token storage': null,
        'JWT token storage': JWT_TOKEN_STORAGE,
        'Use database as token storage': DB_TOKEN_STORAGE
    },
    withoutDesigner: Form.NO_YES,
    storeConversationHistory: Form.NO_YES,
    fbLoadProfile: Form.NO_YES,
    bsBotSku: {
        'F0 (Free)': 'F0',
        'S1 (Standard)': 'S1'
    }
};


function preprocessData (data) {
    return Object.assign({
        eslint: true
    }, data, {
        isMongoOrCosmos: data[MONGODB] || data[AZURE_COSMOS_DB]
    });
}

async function init () {


    const inputsStorage = path.resolve(process.cwd(), '.wingbot');
    let previousData;
    try {
        const data = fs.readFileSync(inputsStorage, { encoding: 'utf8' });
        previousData = JSON.parse(data);
    } catch (e) {
        previousData = {};
    }

    const destination = process.cwd();

    const form = new Form(options, previousData);

    form.data.jwtTokenSecret = previousData.jwtTokenSecret || form.randomSha();

    await form.ask([
        form.list('infrastructure', form.group(
            'Project settings',
            'We have to set up the basics: desired infrastructure, database and messaging platform',
            form.label('Choose a deployment infrastructure')
        )),
        form.list('platform', form.label('Choose a messaging platform')),
        form.list('database', form.label('Choose a database')),
        form.list('analytics', form.label('Choose an analytic tool')),
        form.yesNo('withoutDesigner', form.label('Use without wingbot.ai chatbot designer', 'for experimental purposes you can omit designer connection'), Form.NO_YES)
    ]);

    if (!form.data.withoutDesigner) {
        await form.ask([
            {
                type: 'input',
                name: 'wingbotBotName',
                message: form.group(
                    'Wingbot settings',
                    'We need to know wingbot connection data for every environment.\nBut you can skip these steps and fill these data later.\nYou can find all requested informations in "deployments" settings of your chatbot.',
                    form.label('Wingbot bot name', 'you can fill it later into config/index.js', true)
                ),
                default: path.basename(destination)
            },
            {
                type: 'input',
                name: 'wingbotBotId',
                message: form.label('Wingbot bot ID', 'you can fill it later into config/index.js', true)
            },
            {
                type: 'input',
                name: 'wingbotDevelopmentToken',
                message: form.label('Wingbot "development" snapshot token', 'you can fill it later into config/index.js', true)
            },
            {
                type: 'input',
                name: 'wingbotProductionToken',
                message: form.label('Wingbot "production" snapshot token', 'you can fill it later into config/config.production.js', true)
            }
        ]);
    }

    switch (form.data.database) {
        case AWS_DYNAMO_DB:
        case MONGODB:
        case AZURE_COSMOS_DB: {

            await form.ask([
                form.yesNo('storeConversationHistory', form.label('Store conversation history in DB', 'not necessary for running a chatbot', true), Form.NO_YES),
                form.list('frontendTokenStorage', form.label('Choose a frontend token storage', 'usefull for authorizing webviews', true))
            ]);

            break;
        }
        default:
            form.assign({
                storeConversationHistory: false
            });
            break;
    }

    switch (form.data.database) {
        case MONGODB: {
            await form.ask([
                {
                    type: 'input',
                    message: form.group(
                        'MongoDB connection',
                        'you can fill theese data later into config files, but it\'s recommended to keep connection string in ENV variables',
                        form.label('Database name')
                    ),
                    name: 'mongodbName'
                },
                {
                    type: 'input',
                    message: form.label('Connection string', 'for production environment', true),
                    name: 'mongodbConnectionString'
                }
            ]);

            break;
        }
        case AZURE_COSMOS_DB: {
            await form.ask([
                {
                    type: 'input',
                    message: form.group(
                        'Cosmos DB connection',
                        'you can fill this information later into config files, but it\'s recommended to keep connection string in ENV variable (COSMOSDB_CONNECTION_STRING)',
                        form.label('Database name (wil be created if not existing)')
                    ),
                    name: 'cosmosdbName'
                },
                {
                    type: 'input',
                    message: form.label('Connection string', 'for production environment', true),
                    name: 'cosmosdbConnectionString'
                }
            ]);

            break;
        }
        case AWS_DYNAMO_DB:
        default:
            break;
    }

    switch (form.data.platform) {
        case MESSENGER:
            await form.ask([
                {
                    type: 'input',
                    message: form.group(
                        'FB Messanger platform settings',
                        'Each FB bot needs a FB application in http://developers.facebook.com.\nYou will be able to edit these data later in config directory.',
                        form.label('Facebook App ID', 'you can find it at FB developers portal', true)
                    ),
                    name: 'fbAppId'
                },
                {
                    type: 'input',
                    message: form.label('Facebook Page ID', 'you can find it at settings of the desired FB page', true),
                    name: 'fbPageId'
                },
                {
                    type: 'input',
                    message: form.label('Facebook App Secret', 'you can find it at FB developers portal', true),
                    name: 'fbAppSecret'
                },
                {
                    type: 'input',
                    message: form.label('Facebook Page Token', 'you can generate it at FB developers portal, messenger section of your application', true),
                    name: 'fbPageToken'
                },
                {
                    type: 'input',
                    message: form.label('Facebook Bot Token', 'the random string, you can use for attaching a webhook', true),
                    name: 'fbBotToken',
                    default: form.randomSha()
                },
                form.yesNo('fbLoadProfile', form.label('Download profile data, when starting conversation', 'user profile data will be stored in chatbots state', true), Form.NO_YES)
            ]);
            break;
        case BOT_SERVICE:
            await form.ask([
                {
                    type: 'input',
                    message: form.group(
                        'Bot Service settings',
                        'Each Bot Service bot needs to have a corresponding app registered with Microsoft.\nRegister your bot at https://aka.ms/msaappid and use Application Id and Password here.',
                        form.label('Bot name (handle)', 'Global bot identification, must be unique')
                    ),
                    name: 'bsBotName',
                    default: path.basename(destination)
                }
            ]);

            await form.ask([
                {
                    type: 'input',
                    message: form.label('Bot display name', 'This name is shown to users on most channels'),
                    name: 'bsBotDisplayName',
                    default: form.data.bsBotName
                },
                {
                    type: 'input',
                    message: form.label('Bot Application Id', 'Microsoft App Id or Client ID of your bot application. You can set it later in config or ENV variable BOT_APP_ID', true),
                    name: 'bsAppplicationId'
                },
                {
                    type: 'input',
                    message: form.label('Bot Application Password', 'Microsoft App Password or Client Secret of your bot application. You can set it later in config or ENV variable BOT_APP_PASSWORD', true),
                    name: 'bsAppplicationPassword'
                },
                form.list('bsBotSku', form.label('Bot SKU', 'SKU defines price and performance of your Bot Service. Choose F0 for development and switch to S1 for production'))
            ]);
            break;
        default:
            break;
    }

    switch (form.data.infrastructure) {
        case SERVERLESS_AWS:
            await form.ask([
                {
                    type: 'input',
                    message: form.group(
                        'AWS Deployment settings',
                        'We will prepare a serverless.yml file, where you will be able to edit these data later',
                        form.label('Your AWS Account ID')
                    ),
                    name: 'awsAccountId',
                    default: process.env.AWS_ACCOUNT_ID
                },
                {
                    type: 'input',
                    message: form.label('Your AWS Region'),
                    name: 'awsRegion',
                    default: 'eu-central-1'
                }
            ]);
            break;
        case SERVERLESS_AZURE:
            await form.ask([
                {
                    type: 'input',
                    message: form.group(
                        'Azure Functions deployment settings',
                        'We will prepare an ARM template where you will be able to edit this information later',
                        form.label('Resource Group name')
                    ),
                    name: 'azureRgName',
                    default: `${form.data.bsBotName}-rg`
                },
                {
                    type: 'input',
                    message: form.label('Function App name'),
                    name: 'azureFunctionAppName',
                    default: form.data.bsBotName
                }
            ]);
            break;
        case EXPRESS_AZURE:
        case EXPRESS:
        default:
            break;
    }

    if (form.data.googleAnalytics) {
        await form.ask([
            {
                type: 'input',
                message: form.group(
                    'Analytics settings',
                    'we will configure Google Analytics for your production environment',
                    form.label('Your Universal Analytics tracking ID')
                ),
                name: 'gaCode'
            }
        ]);
    }


    try {
        fs.writeFileSync(inputsStorage, JSON.stringify(form.data));
    } catch (e) {
        // noop
    }
    const root = path.resolve(__dirname, path.join('..', 'templates'));

    const data = preprocessData(form.data);

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
}

module.exports = {
    options,
    init,
    preprocessData
};

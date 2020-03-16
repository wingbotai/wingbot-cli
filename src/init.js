/*
 * @author David Menger
 */
'use strict';

const path = require('path');
const chalk = require('chalk');
const latestVersion = require('latest-version');
const fs = require('fs');
const Form = require('./Form');
const { TemplateRenderer } = require('./templateRenderer');

const packageJson = require('../package.json');

const { log } = console;

const SERVERLESS_AWS = 'awsServerless';
const EXPRESS = 'express';
const EXPRESS_AZURE = 'azureExpress';
const SERVERLESS_AZURE = 'azureServerless';

const MESSENGER = 'messenger';
const BOT_SERVICE = 'botService';
const WEBCHAT = 'webchat';
const WINGBOT = 'wingbot';

const AWS_DYNAMO_DB = 'dynamodbStorage';
const MONGODB = 'mongodbStorage';
const AZURE_COSMOS_DB = 'cosmosdbStorage';
const MSSQL = 'mssqlStorage';

const DB_TOKEN_STORAGE = 'dbTokenStorage';
const JWT_TOKEN_STORAGE = 'jwtTokenStorage';

const UNIVERSAL_ANALYTICS = 'googleAnalytics';

const LOGZIO_TOKEN = 'logzioToken';
const SENTRY = 'sentry';
const APP_INSIGHTS = 'appInsights';

const G_SHEET_TESTING_SUIT = 'gSheetTestingSuit';

const options = {
    infrastructure: {
        'Express application': EXPRESS,
        'Serverless AWS': SERVERLESS_AWS,
        'Azure Functions': SERVERLESS_AZURE,
        'Azure Web Apps': EXPRESS_AZURE
        // 'Wb.ai': WINGBOT
    },
    platform: {
        'Facebook messenger': MESSENGER,
        'Azure Bot Service': BOT_SERVICE,
        Webchat: WEBCHAT
    },
    database: {
        MongoDB: MONGODB,
        'AWS DynamoDB': AWS_DYNAMO_DB,
        'Azure Cosmos DB (MongoDB protocol)': AZURE_COSMOS_DB,
        'Microsoft SQL Server': MSSQL
    },
    analytics: {
        None: null,
        'Universal Analytics': UNIVERSAL_ANALYTICS
    },
    conversationTesting: {
        None: null,
        'Gsheet testing suit': G_SHEET_TESTING_SUIT
    },
    frontendTokenStorage: {
        'No frontend token storage': null,
        'JWT token storage': JWT_TOKEN_STORAGE,
        'Use database as token storage': DB_TOKEN_STORAGE
    },
    withDesigner: {
        'Use wingbot.ai designer (recommended)': 1,
        'I\'ll create bot programmatically': 0
    },
    storeConversationHistory: Form.NO_YES,
    fbLoadProfile: Form.NO_YES,
    bsBotSku: {
        'F0 (Free)': 'F0',
        'S1 (Standard)': 'S1'
    },
    monitoring: {
        Sentry: SENTRY,
        LogzIO: LOGZIO_TOKEN
    },
    monitoringAzure: {
        AppInsights: APP_INSIGHTS
    }
};


function preprocessData (data) {
    return Object.assign({
        eslint: true
    }, data, {
        isMongoOrCosmos: data[MONGODB] || data[AZURE_COSMOS_DB],
        isAwsOrAzure: data[SERVERLESS_AWS] || data[SERVERLESS_AZURE],
        isAzure: data[SERVERLESS_AZURE] || data[EXPRESS_AZURE],
        isLogzioTokenOrSentry: data[LOGZIO_TOKEN] || data[SENTRY],
        isLogzioTokenOrSentryorAppIngsights: data[LOGZIO_TOKEN]
            || data[SENTRY] || data[APP_INSIGHTS],
        expressOrAppService: data[EXPRESS_AZURE] || data[EXPRESS],
        webchatOrMessenger: data[WEBCHAT] || data[MESSENGER],
        productionDomain: data.productionDomain
            ? data.productionDomain.trim()
            : data.productionDomain,
        productionApiDomain: data.productionApiDomain
            ? data.productionApiDomain.trim()
            : data.productionApiDomain,
        stagingDomain: data.stagingDomain
            ? data.stagingDomain.trim()
            : data.stagingDomain,
        stagingApiDomain: data.stagingApiDomain
            ? data.stagingApiDomain.trim()
            : data.stagingApiDomain,
        devDomain: data.devDomain
            ? data.devDomain.trim()
            : data.devDomain,
        devApiDomain: data.devApiDomain
            ? data.devApiDomain.trim()
            : data.devApiDomain,
        testDomain: data.testDomain
            ? data.testDomain.trim()
            : data.testDomain,
        testApiDomain: data.testApiDomain
            ? data.testApiDomain.trim()
            : data.testApiDomain,
        cosmosdbConnectionString: data.cosmosdbConnectionString
            ? data.cosmosdbConnectionString
                .replace(
                    /mongodb:\/\/[^:]+:[^@=]+(=+)/,
                    x => x.replace(/=+$/, z => encodeURIComponent(z))
                )
                .replace(
                    /[&?]?replicaSet=globaldb/,
                    ''
                )
            : null,
        stagingCosmosdbConnectionString: data.stagingCosmosdbConnectionString
            ? data.stagingCosmosdbConnectionString
                .replace(
                    /mongodb:\/\/[^:]+:[^@=]+(=+)/,
                    x => x.replace(/=+$/, z => encodeURIComponent(z))
                )
                .replace(
                    /[&?]?replicaSet=globaldb/,
                    ''
                )
            : null
    });
}

async function finish (formData, destination) {
    const root = path.resolve(__dirname, path.join('..', 'templates'));

    const data = preprocessData(formData);
    const tr = new TemplateRenderer(root, destination, data);

    await tr.render();

    log(`\n${chalk.green.bold('Your project is ready!')}\n\n${chalk.white('do not forget to run')} ${chalk.magenta('npm install')}`);
    log(`${chalk.white('do not forget to set')} ${chalk.magenta('NODE_ENV = production')} ${chalk.white('on production environment')}`);
    switch (data.infrastructure) {
        case SERVERLESS_AWS:
            log(`${chalk.white('for deployment use')} ${chalk.magenta('npm run deploy:production')}`);
            break;
        case EXPRESS_AZURE:
            log(`${chalk.white('do not forget to set')} ${chalk.magenta('WEBSITE_NODE_DEFAULT_VERSION = 8.11.1')} ${chalk.white('on all environments')}`);
            break;
        default:
            break;
    }
}

async function processGenerator (args, skipForm) {

    // check the latest version
    try {
        const ver = await Promise.race([
            new Promise((r, e) => setTimeout(e, 2000)),
            latestVersion('wingbot-cli')
        ]);

        if (ver !== packageJson.version) {
            // eslint-disable-next-line no-console
            console.log(`\n${chalk.red('New version')} ${ver} ${chalk.red('of wingbot-cli has been released. Please update your wingbot CLI.')}\n`);
        }
    } catch (e) {
        // do not write nothing
    }

    const destination = process.cwd();

    if (args.W) {
        await finish({
            infrastructure: WINGBOT,
            [WINGBOT]: true,
            [SERVERLESS_AWS]: true,
            database: [MONGODB],
            [MONGODB]: true,
            platform: MESSENGER,
            [MESSENGER]: true,
            analytics: UNIVERSAL_ANALYTICS,
            conversationTesting: G_SHEET_TESTING_SUIT,
            [UNIVERSAL_ANALYTICS]: true,
            withDesigner: true,
            notifications: true,
            storeConversationHistory: false,
            monitoring: SENTRY
        }, destination);
        return;
    }

    const inputsStorage = path.resolve(process.cwd(), '.wingbot');
    let previousData;
    let formData;
    try {
        const data = fs.readFileSync(inputsStorage, { encoding: 'utf8' });
        previousData = JSON.parse(data);
        formData = previousData;
    } catch (e) {
        previousData = {};
        if (skipForm) {
            // eslint-disable-next-line no-console
            console.log(`\n${chalk.red('.wingbot file not found - cannot update the project')}\n`);
        }
    }

    if (!skipForm) {
        const form = new Form(options, previousData);

        form.data.jwtTokenSecret = previousData.jwtTokenSecret
            || (form.randomSha() + form.randomSha());

        await form.ask([
            {
                type: 'input',
                name: 'projectName',
                message: form.group(
                    'Project settings',
                    'We have to set up the basics: name, desired infrastructure, database and messaging platform',
                    form.label('Choose a name for your project')
                ),
                default: path.basename(destination)
            },
            form.list('infrastructure', form.group(
                'Project settings',
                'We have to set up the basics: desired infrastructure, database and messaging platform',
                form.label('Choose a deployment infrastructure')
            )),
            form.list('platform', form.label('Choose a messaging platform')),
            form.list('database', form.label('Choose a database')),
            form.list('analytics', form.label('Choose an analytic tool')),
            form.list('conversationTesting', form.label('Choose a conversation testing tool')),
            form.list('withDesigner', form.label('Connect with wingbot.ai designer', 'for experimental purposes you can make a chatbot on your own'))
        ]);


        /**
         * publicStorage
         * domain
         * certificateArnStaging
         * certificateArnProduction
         */

        const urlProjectName = `${form.data.projectName}`
            .replace(/[^a-zA-Z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();

        await form.ask([
            form.yesNo('publicStorage', form.group(
                'Chatbot application destination',
                'Make configuration ready for the application deployment',
                form.label('Chatbot will publish static website or assets', 'usefull for including image assets or having a test page for MS BotService')
            ), Form.NO_YES),
            {
                type: 'input',
                name: 'productionDomain',
                message: form.label('Producton bot domain', 'assets will be stored here', true),
                default: form.data.infrastructure === EXPRESS_AZURE ? `${urlProjectName}.azurewebsites.net` : undefined
            }
        ]);

        if (form.data.infrastructure === SERVERLESS_AZURE
            || form.data.infrastructure === EXPRESS_AZURE) {

            Object.assign(form.options.monitoring, form.options.monitoringAzure);
        }

        await form.ask([
            form.list('monitoring', form.label('Choose a monitoring'))
        ]);

        switch (form.data.monitoring) {
            case SENTRY:
                await form.ask([
                    {
                        type: 'input',
                        name: 'sentry',
                        message: form.label('Sentry url ', 'Insert Sentry url to monitor your application. Keep empty to not set up a logging stack.', true)
                    }
                ]);

                break;

            case LOGZIO_TOKEN: {
                await form.ask([
                    {
                        type: 'input',
                        name: 'logzioToken',
                        message: form.label('Logz.io token', 'Insert your token to be able to monitor your application. Keep empty to not set up a logging stack.', true)
                    }

                ]);

                break;
            }
            default:
                break;
        }

        if (form.data.infrastructure === SERVERLESS_AWS) {
            await form.ask([
                {
                    type: 'input',
                    name: 'productionApiDomain',
                    message: form.label('Production API  domain', 'domain of API Gateway endpoint', true),
                    default: form.data.productionDomain.replace(/\./, '-api.')
                }
            ]);
        }

        await form.ask([
            form.yesNo('stagingEnvironment', form.label('Deploy staging environment', 'will prepare staging configuration'), Form.NO_YES)
        ]);
        await form.ask([
            form.yesNo('devEnvironment', form.label('Deploy dev environment', 'will prepare staging configuration'), Form.NO_YES)
        ]);
        await form.ask([
            form.yesNo('testEnvironment', form.label('Deploy test environment', 'will prepare staging configuration'), Form.NO_YES)
        ]);

        if (form.data.stagingEnvironment) {
            await form.ask([
                {
                    type: 'input',
                    name: 'stagingDomain',
                    message: form.label('Staging chatbot domain', 'will set chatbot url in configuration files', true),
                    default: form.data.infrastructure === EXPRESS_AZURE ? `${urlProjectName}-staging.azurewebsites.net` : undefined
                }
            ]);

            if (form.data.infrastructure === SERVERLESS_AWS) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'stagingApiDomain',
                        message: form.label('Staging API domain', 'domain of staging API Gateway endpoint', true),
                        default: form.data.stagingDomain.replace(/\./, '-api.')
                    }
                ]);
            }
        }

        if (form.data.devEnvironment) {
            await form.ask([
                {
                    type: 'input',
                    name: 'devDomain',
                    message: form.label('Dev chatbot domain', 'will set chatbot url in configuration files', true),
                    default: form.data.infrastructure === EXPRESS_AZURE ? `${urlProjectName}-dev.azurewebsites.net` : undefined
                }
            ]);

            if (form.data.infrastructure === SERVERLESS_AWS) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'devApiDomain',
                        message: form.label('Dev API domain', 'domain of dev API Gateway endpoint', true),
                        default: form.data.dev.replace(/\./, '-api.')
                    }
                ]);
            }
        }

        if (form.data.testEnvironment) {
            await form.ask([
                {
                    type: 'input',
                    name: 'testDomain',
                    message: form.label('Test chatbot domain', 'will set chatbot url in configuration files', true),
                    default: form.data.infrastructure === EXPRESS_AZURE ? `${urlProjectName}-test.azurewebsites.net` : undefined
                }
            ]);

            if (form.data.infrastructure === SERVERLESS_AWS) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'testApiDomain',
                        message: form.label('Test API domain', 'domain of test API Gateway endpoint', true),
                        default: form.data.testDomain.replace(/\./, '-api.')
                    }
                ]);
            }
        }

        if (form.data.infrastructure === SERVERLESS_AWS && form.data.publicStorage) {
            await form.ask([
                {
                    type: 'input',
                    name: 'certificateArnProduction',
                    message: form.label('Production certificate ARN', 'will set ARN in serverless configuration file', true)
                }
            ]);

            if (form.data.stagingEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'certificateArnStaging',
                        message: form.label('Staging certificate ARN', 'will set ARN in serverless configuration file', true),
                        default: form.data.certificateArnProduction
                    }
                ]);
            }

            if (form.data.devEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'certificateArnDev',
                        message: form.label('Dev certificate ARN', 'will set ARN in serverless configuration file', true),
                        default: form.data.certificateArnProduction
                    }
                ]);
            }

            if (form.data.testEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'certificateArnTest',
                        message: form.label('Test certificate ARN', 'will set ARN in serverless configuration file', true),
                        default: form.data.certificateArnProduction
                    }
                ]);
            }
        }

        if (form.data.withDesigner) {
            if ([MONGODB, AZURE_COSMOS_DB, MSSQL].includes(form.data.database)
                && form.data.messenger) {

                await form.ask([
                    form.yesNo('notifications', form.label('Deploy Ads subsystem for Notifications'), Form.YES_NO)
                ]);
            }

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
                },
                {
                    type: 'input',
                    message: form.label('Production API key', 'key used for accesing a chatbot API', true),
                    name: 'productionApiToken',
                    default: form.randomSha() + form.randomSha()
                        + form.randomSha() + form.randomSha()
                }
            ]);

            if (form.data.stagingEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'wingbotStagingToken',
                        message: form.label('Wingbot "staging" snapshot token', 'you can fill it later into config/config.staging.js', true)
                    },
                    {
                        type: 'input',
                        message: form.label('Staging API key', 'key used for accesing a chatbot API', true),
                        name: 'stagingApiToken',
                        default: form.randomSha() + form.randomSha()
                    }
                ]);
            }

            if (form.data.devEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'wingbotDevToken',
                        message: form.label('Wingbot "dev" snapshot token', 'you can fill it later into config/config.staging.js', true)
                    },
                    {
                        type: 'input',
                        message: form.label('Dev API key', 'key used for accesing a chatbot API', true),
                        name: 'devApiToken',
                        default: form.randomSha() + form.randomSha()
                    }
                ]);
            }

            if (form.data.testEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'wingbotTestToken',
                        message: form.label('Wingbot "test" snapshot token', 'you can fill it later into config/config.staging.js', true)
                    },
                    {
                        type: 'input',
                        message: form.label('Test API key', 'key used for accesing a chatbot API', true),
                        name: 'testApiToken',
                        default: form.randomSha() + form.randomSha()
                    }
                ]);
            }
        }

        switch (form.data.database) {
            case AWS_DYNAMO_DB:
            case MONGODB:
            case MSSQL:
            case AZURE_COSMOS_DB: {

                await form.ask([
                    form.yesNo('storeConversationHistory', form.label('Store conversation history in DB', 'not necessary for running a chatbot', true), Form.NO_YES),
                    form.yesNo('anonymizeConversationLogs', form.label('Anonymize conversation logs', 'by passing anonymizer together with conversation logger to Sender', true), Form.YES_NO),
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
                        name: 'mongodbName',
                        default: urlProjectName
                    },
                    {
                        type: 'input',
                        message: form.label('Connection string', 'for production environment', true),
                        name: 'mongodbConnectionString'
                    }
                ]);

                if (form.data.stagingEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Staging database name', 'for staging environment', true),
                            name: 'stagingMongodbName',
                            default: form.data.mongodbName
                        },
                        {
                            type: 'input',
                            message: form.label('Staging connection string', 'for staging environment', true),
                            name: 'stagingMongodbConnectionString',
                            default: form.data.mongodbConnectionString
                        }
                    ]);
                }

                if (form.data.devEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Dev database name', 'for dev environment', true),
                            name: 'devMongodbName',
                            default: form.data.mongodbName
                        },
                        {
                            type: 'input',
                            message: form.label('Dev connection string', 'for dev environment', true),
                            name: 'devMongodbConnectionString',
                            default: form.data.mongodbConnectionString
                        }
                    ]);
                }

                if (form.data.testEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Test database name', 'for staging environment', true),
                            name: 'testMongodbName',
                            default: form.data.mongodbName
                        },
                        {
                            type: 'input',
                            message: form.label('Test connection string', 'for staging environment', true),
                            name: 'testMongodbConnectionString',
                            default: form.data.mongodbConnectionString
                        }
                    ]);
                }

                break;
            }
            case AZURE_COSMOS_DB: {
                await form.ask([
                    {
                        type: 'input',
                        message: form.group(
                            'Cosmos DB connection',
                            'you can fill this information later into config files, but it\'s recommended to keep connection string in ENV variable (COSMOSDB_CONNECTION_STRING)',
                            form.label('Database name', 'Leave empty if you don\'t want to create new database.', true)
                        ),
                        name: 'cosmosdbName'
                    },
                    {
                        type: 'input',
                        message: form.label('Connection string', 'For existing database. Will be ignored if you specified Database name.', true),
                        name: 'cosmosdbConnectionString'
                    }
                ]);

                if (form.data.stagingEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Staging database name', 'Leave empty if you don\'t want to create new database.', true),
                            name: 'stagingCosmosdbName',
                            default: form.data.cosmosdbName
                        },
                        {
                            type: 'input',
                            message: form.label('Staging connection string', 'For existing database. Will be ignored if you specified Database name.', true),
                            name: 'stagingCosmosdbConnectionString',
                            default: form.data.cosmosdbConnectionString
                        }
                    ]);
                }

                if (form.data.devEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Dev database name', 'Leave empty if you don\'t want to create new database.', true),
                            name: 'devCosmosdbName',
                            default: form.data.cosmosdbName
                        },
                        {
                            type: 'input',
                            message: form.label('Dev connection string', 'For existing database. Will be ignored if you specified Database name.', true),
                            name: 'devCosmosdbConnectionString',
                            default: form.data.cosmosdbConnectionString
                        }
                    ]);
                }

                if (form.data.testEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Test database name', 'Leave empty if you don\'t want to create new database.', true),
                            name: 'testCosmosdbName',
                            default: form.data.cosmosdbName
                        },
                        {
                            type: 'input',
                            message: form.label('Test connection string', 'For existing database. Will be ignored if you specified Database name.', true),
                            name: 'testCosmosdbConnectionString',
                            default: form.data.cosmosdbConnectionString
                        }
                    ]);
                }

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
                            'FB Messanger settings - production',
                            'Each FB bot needs a FB application in http://developers.facebook.com.\nYou will be able to edit these data later in config directory.',
                            form.label('Facebook App ID', 'you can find it at FB developers portal', true)
                        ),
                        name: 'fbAppId'
                    },
                    {
                        type: 'input',
                        message: form.label('Facebook App Secret', 'you can find it at FB developers portal', true),
                        name: 'fbAppSecret'
                    },
                    {
                        type: 'input',
                        message: form.label('Facebook Page ID', 'you can find it at settings of the desired FB page', true),
                        name: 'fbPageId'
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

                if (form.data.stagingEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'FB Messanger settings - staging',
                                'Each FB bot needs a FB application in http://developers.facebook.com.\nYou will be able to edit these data later in config directory.',
                                form.label('Facebook App ID', 'you can find it at FB developers portal', true)
                            ),
                            name: 'fbAppIdStaging'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook App Secret', 'you can find it at FB developers portal', true),
                            name: 'fbAppSecretStaging'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Page ID', 'you can find it at settings of the desired FB page', true),
                            name: 'fbPageIdStaging'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Page Token', 'you can generate it at FB developers portal, messenger section of your application', true),
                            name: 'fbPageTokenStaging'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Bot Token', 'the random string, you can use for attaching a webhook', true),
                            name: 'fbBotTokenStaging',
                            default: form.randomSha()
                        }
                    ]);
                }

                if (form.data.devEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'FB Messanger settings - dev',
                                'Each FB bot needs a FB application in http://developers.facebook.com.\nYou will be able to edit these data later in config directory.',
                                form.label('Facebook App ID', 'you can find it at FB developers portal', true)
                            ),
                            name: 'fbAppIdDev'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook App Secret', 'you can find it at FB developers portal', true),
                            name: 'fbAppSecretDev'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Page ID', 'you can find it at settings of the desired FB page', true),
                            name: 'fbPageIdDev'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Page Token', 'you can generate it at FB developers portal, messenger section of your application', true),
                            name: 'fbPageTokenDev'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Bot Token', 'the random string, you can use for attaching a webhook', true),
                            name: 'fbBotTokenDev',
                            default: form.randomSha()
                        }
                    ]);
                }

                if (form.data.testEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'FB Messanger settings - test',
                                'Each FB bot needs a FB application in http://developers.facebook.com.\nYou will be able to edit these data later in config directory.',
                                form.label('Facebook App ID', 'you can find it at FB developers portal', true)
                            ),
                            name: 'fbAppIdTest'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook App Secret', 'you can find it at FB developers portal', true),
                            name: 'fbAppSecretTest'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Page ID', 'you can find it at settings of the desired FB page', true),
                            name: 'fbPageIdTest'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Page Token', 'you can generate it at FB developers portal, messenger section of your application', true),
                            name: 'fbPageTokenTest'
                        },
                        {
                            type: 'input',
                            message: form.label('Facebook Bot Token', 'the random string, you can use for attaching a webhook', true),
                            name: 'fbBotTokenTest',
                            default: form.randomSha()
                        }
                    ]);
                }
                break;
            case WEBCHAT:
                await form.ask([
                    {
                        type: 'input',
                        message: form.group(
                            'Webchat settings - production',
                            'Information about webchat configuration\nYou will be able to edit these data later in config directory.',
                            form.label('Webchat App ID', '', true),
                        ),
                        name: 'fbAppId'
                    },
                    {
                        type: 'input',
                        message: form.label('Webchat Channel ID', '', true),
                        name: 'wchChannelId'
                    },
                    {
                        type: 'input',
                        message: form.label('Webchat APP URL', '', true),
                        name: 'wchApiUrl'
                    }
                ]);

                if (form.data.stagingEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Webchat settings - Stage',
                                'Information about webchat configuration\nYou will be able to edit these data later in config directory.',
                                form.label('Webchat App ID', '', true),
                            ),
                            name: 'fbAppIdStaging'
                        },
                        {
                            type: 'input',
                            message: form.label('Webchat Channel ID', '', true),
                            name: 'wchChannelIdStaging'
                        },
                        {
                            type: 'input',
                            message: form.label('Webchat APP URL', '', true),
                            name: 'wchApiUrlStaging'
                        }
                    ]);
                }

                if (form.data.devEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Webchat settings - Dev',
                                'Information about webchat configuration\nYou will be able to edit these data later in config directory.',
                                form.label('Webchat App ID', '', true),
                            ),
                            name: 'fbAppIdDev'
                        },
                        {
                            type: 'input',
                            message: form.label('Webchat Channel ID', '', true),
                            name: 'wchChannelIdDev'
                        },
                        {
                            type: 'input',
                            message: form.label('Webchat APP URL', '', true),
                            name: 'wchApiUrlDev'
                        }
                    ]);
                }

                if (form.data.testEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Webchat settings - Test',
                                'Information about webchat configuration\nYou will be able to edit these data later in config directory.',
                                form.label('Webchat App ID', '', true),
                            ),
                            name: 'fbAppIdTest'
                        },
                        {
                            type: 'input',
                            message: form.label('Webchat Channel ID', '', true),
                            name: 'wchChannelIdTest'
                        },
                        {
                            type: 'input',
                            message: form.label('Webchat APP URL', '', true),
                            name: 'wchApiUrlTest'
                        }
                    ]);
                }
                break;
            case BOT_SERVICE:
                await form.ask([
                    {
                        type: 'input',
                        message: form.group(
                            'Bot Service settings - production',
                            'Each Bot Service bot needs to have a corresponding app registered with Microsoft.\nRegister your bot at https://aka.ms/msaappid and use Application Id and Password here.',
                            form.label('Bot name (handle)', 'Global bot identification, must be unique')
                        ),
                        name: 'bsBotName',
                        default: path.basename(destination)
                    },
                    {
                        type: 'input',
                        message: form.label('Bot display name', 'This name is shown to users on most channels'),
                        name: 'bsBotDisplayName',
                        default: form.data.bsBotName
                    },
                    {
                        type: 'input',
                        message: form.label(
                            'Bot Application Id',
                            'Microsoft App Id or Client ID of your bot application. Reqired to create channels registration'
                        ),
                        name: 'bsAppId'
                    },
                    {
                        type: 'input',
                        message: form.label(
                            'Bot Application Password',
                            'Microsoft App Password or Client Secret of your bot application. You can set it later in config or ENV variable BOT_APP_PASSWORD',
                            true
                        ),
                        name: 'bsAppPassword'
                    },
                    form.list('bsBotSku', form.label(
                        'Bot SKU',
                        'SKU defines price and performance of your Bot Service. Choose F0 for development and switch to S1 for production'
                    ))
                ]);

                if (form.data.stagingEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Bot Service settings - staging',
                                'Each Bot Service bot needs to have a corresponding app registered with Microsoft.\nRegister your bot at https://aka.ms/msaappid and use Application Id and Password here.',
                                form.label(
                                    'Bot Application Id',
                                    'Microsoft App Id or Client ID of your bot application. Reqired to create channels registration'
                                )
                            ),
                            name: 'bsAppIdStaging'
                        },
                        {
                            type: 'input',
                            message: form.label(
                                'Bot Application Password',
                                'Microsoft App Password or Client Secret of your bot application. You can set it later in config or ENV variable BOT_APP_PASSWORD',
                                true
                            ),
                            name: 'bsAppPasswordStaging'
                        }
                    ]);
                }

                if (form.data.devEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Bot Service settings - dev',
                                'Each Bot Service bot needs to have a corresponding app registered with Microsoft.\nRegister your bot at https://aka.ms/msaappid and use Application Id and Password here.',
                                form.label(
                                    'Bot Application Id',
                                    'Microsoft App Id or Client ID of your bot application. Reqired to create channels registration'
                                )
                            ),
                            name: 'bsAppIdDev'
                        },
                        {
                            type: 'input',
                            message: form.label(
                                'Bot Application Password',
                                'Microsoft App Password or Client Secret of your bot application. You can set it later in config or ENV variable BOT_APP_PASSWORD',
                                true
                            ),
                            name: 'bsAppPasswordDev'
                        }
                    ]);
                }

                if (form.data.testEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Bot Service settings - test',
                                'Each Bot Service bot needs to have a corresponding app registered with Microsoft.\nRegister your bot at https://aka.ms/msaappid and use Application Id and Password here.',
                                form.label(
                                    'Bot Application Id',
                                    'Microsoft App Id or Client ID of your bot application. Reqired to create channels registration'
                                )
                            ),
                            name: 'bsAppIdTest'
                        },
                        {
                            type: 'input',
                            message: form.label(
                                'Bot Application Password',
                                'Microsoft App Password or Client Secret of your bot application. You can set it later in config or ENV variable BOT_APP_PASSWORD',
                                true
                            ),
                            name: 'bsAppPasswordTest'
                        }
                    ]);
                }
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
            case EXPRESS_AZURE:
                await form.ask([
                    {
                        type: 'input',
                        message: form.group(
                            'Azure deployment settings',
                            'We will prepare an ARM template where you will be able to edit this information later',
                            form.label('Resource Group name')
                        ),
                        name: 'azureRgName',
                        default: `${form.data.bsBotName || form.data.projectName}-rg`
                    },
                    {
                        type: 'input',
                        message: form.label('Azure region'),
                        name: 'azureRegion',
                        default: 'northeurope'
                    },
                    {
                        type: 'input',
                        message: form.label('App Service name'),
                        name: 'azureAppName',
                        default: form.data.bsBotName
                    }
                ]);
                break;
            case EXPRESS:
            default:
                break;
        }

        if (form.data.conversationTesting) {
            await form.ask([
                {
                    type: 'input',
                    message: form.group(
                        'Conversation testing settings',
                        'we will configure Google Sheet for your production environment',
                        form.label('ID of the Google testing sheet')
                    ),
                    name: 'gSheetTestingSuit'
                }
            ]);

        }

        if (form.data.googleAnalytics) {
            await form.ask([
                {
                    type: 'input',
                    message: form.group(
                        'Analytics settings',
                        'we will configure Google Analytics for your production environment',
                        form.label('Production Universal Analytics tracking ID')
                    ),
                    name: 'gaCode'
                }
            ]);

            if (form.data.stagingEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        message: form.label('Staging Universal Analytics tracking ID'),
                        name: 'gaCodeStaging'
                    }
                ]);
            }

            if (form.data.devEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        message: form.label('Dev Universal Analytics tracking ID'),
                        name: 'gaCodeDev'
                    }
                ]);
            }

            if (form.data.testEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        message: form.label('Test Universal Analytics tracking ID'),
                        name: 'gaCodeTest'
                    }
                ]);
            }
        }

        formData = form.data;
    }

    try {
        const save = Object.assign({}, formData, { cliVersion: packageJson.version });
        fs.writeFileSync(inputsStorage, JSON.stringify(save, undefined, 2));
    } catch (e) {
        // noop
    }

    await finish(formData, destination);
}

function init (args) {
    return processGenerator(args);
}

function update (args) {
    return processGenerator(args, true);
}

module.exports = {
    options,
    init,
    update,
    preprocessData
};

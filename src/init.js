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

const MESSENGER = 'messenger';
const BOT_SERVICE = 'botService';
const WINGBOT_ORCHESTRATOR = 'wingbotOrchestrator';

const AWS_DYNAMO_DB = 'dynamodbStorage';
const MONGODB = 'mongodbStorage';
const AZURE_COSMOS_DB = 'cosmosdbStorage';
const MSSQL = 'mssqlStorage';

const GOOGLE_ANALYTICS = 'googleAnalytics';
const TABLE_STORAGE = 'tableStorage';

const SENTRY = 'sentry';
const APP_INSIGHTS = 'appInsights';

const G_SHEET_TESTING_SUIT = 'gSheetTestingSuit';

const options = {
    infrastructure: {
        'Express application': EXPRESS,
        'Serverless AWS': SERVERLESS_AWS,
        'Azure Web Apps': EXPRESS_AZURE
    },
    platform: {
        'Wingbot Orchestrator': WINGBOT_ORCHESTRATOR,
        'Facebook Messenger': MESSENGER,
        'Azure Bot Service': BOT_SERVICE
    },
    database: {
        MongoDB: MONGODB,
        'AWS DynamoDB': AWS_DYNAMO_DB,
        'Azure Cosmos DB (MongoDB protocol)': AZURE_COSMOS_DB
        // 'Microsoft SQL Server': MSSQL
    },
    analytics: {
        None: null,
        'Google Analytics 4': GOOGLE_ANALYTICS,
        'Table Storage': TABLE_STORAGE
    },
    conversationTesting: {
        None: null,
        'Gsheet testing suit': G_SHEET_TESTING_SUIT
    },
    keyvault: {
        'Use keyvault for storing password': 1,
        'I\'will store passwd locally.': 0
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
        'AppInsights (only for Azure Cloud)': APP_INSIGHTS
    }

};

function preprocessData (data) {
    const languageList = data.languages
        ? data.languages
            .split(',')
            .map((l) => l.trim())
            .filter((l) => !!l)
            .map((lang, i) => ({ lang, isDefault: i === 0 }))
        : [];
    return {
        eslint: true,
        ...data,
        languageList,
        hasLanguageList: languageList.length !== 0,
        isMongoOrCosmos: data[MONGODB] || data[AZURE_COSMOS_DB],
        isSentryOrAppInsights: data[SENTRY] || data[APP_INSIGHTS],
        tableStorage: data.analytics === TABLE_STORAGE,
        googleAnalytics: data.analytics === GOOGLE_ANALYTICS,
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
                    (x) => x.replace(/=+$/, (z) => encodeURIComponent(z))
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
                    (x) => x.replace(/=+$/, (z) => encodeURIComponent(z))
                )
                .replace(
                    /[&?]?replicaSet=globaldb/,
                    ''
                )
            : null
    };
}

async function finish (formData, destination) {
    const root = path.resolve(__dirname, path.join('..', 'templates'));

    const data = preprocessData(formData);
    const tr = new TemplateRenderer(root, destination, data);

    await tr.render();

    log(`\n${chalk.green.bold('Your project is ready!')}\n\n${chalk.white('do not forget to run')} ${chalk.magenta('npm install')}`);
    log(`${chalk.white('do not forget to set')} ${chalk.magenta('NODE_ENV = production')} ${chalk.white('on production environment')}`);
    log(`${chalk.white('for AWS deployment use')} ${chalk.magenta('npm run deploy:production')}`);

    if (data.gSheetTestingSuit) {
        log(`${chalk.white('do not forget to put')} ${chalk.magenta('google-token.json')} ${chalk.white('to project root to be able to run automated tests')}`);
    }
}

async function processGenerator (args, skipForm) {

    // check the latest version
    try {
        const ver = await Promise.race([
            new Promise((r, e) => {
                setTimeout(e, 2000);
            }),
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
            form.list('platform', form.group(
                'Project settings',
                'We have to set up the basics: desired infrastructure, database and messaging platform',
                form.label('Choose a messaging platform')
            ))
        ]);

        await form.ask([
            form.list('infrastructure', form.label('Choose a primary deployment infrastructure')),
            form.list('database', form.label('Choose a database')),
            form.list('conversationTesting', form.label('Choose a conversation testing tool')),
            form.list('withDesigner', form.label('Connect with wingbot.ai designer', 'for experimental purposes you can make a chatbot on your own'))
        ]);

        if (form.data.platform === WINGBOT_ORCHESTRATOR
            && [MONGODB, AZURE_COSMOS_DB].includes(form.data.database)) {

            await form.ask([
                form.yesNo('auditLog', form.label('Enable Audit Log', 'enables hashing of conversation logs and logging important API actions'), Form.NO_YES)
            ]);
        }

        if ([EXPRESS_AZURE].includes(form.data.infrastructure)) {
            await form.ask([
                form.list('analytics', form.label('Choose an analytic tool')),
                form.list('keyvault', form.label('Choose if you want to use keyvault'))
            ]);
        } else {
            delete form.options.analytics['Table Storage'];
            await form.ask([
                form.list('analytics', form.label('Choose an analytic tool'))
            ]);
        }

        if (form.data.analytics === TABLE_STORAGE) {
            await form.ask([
                {
                    type: 'input',
                    name: 'tableStorageName',
                    message: form.label('Table Storage Name ', 'Enter Azure Table Storage Name', true)
                }
            ]);
            if (form.data.keyvault !== 1) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'tableStorageSecret',
                        message: form.label('Table Storage Secret ', 'Enter Azure Table Storage Secret', true)
                    }
                ]);
            }
        }

        /**
         * domain
         * certificateArnStaging
         * certificateArnProduction
         */

        const urlProjectName = `${form.data.projectName}`
            .replace(/[^a-zA-Z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();

        await form.ask([
            form.list('monitoring', form.label('Choose a monitoring'))
        ]);

        switch (form.data.monitoring) {
            case SENTRY:
                await form.ask([
                    {
                        type: 'input',
                        name: 'sentryDsn',
                        message: form.label('Sentry DSN ', 'Insert Sentry DSN to monitor your application. Keep empty to not set up a logging stack.', true)
                    }
                ]);

                break;

            default:
                break;
        }

        await form.ask([
            {
                type: 'input',
                name: 'productionDomain',
                message: form.label('Production bot domain', 'assets will be stored here', true),
                default: form.data.infrastructure === EXPRESS_AZURE ? `${urlProjectName}.azurewebsites.net` : undefined
            }
        ]);

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

        const defaultDomain = form.data.productionDomain.replace(/(-prod(uction)?)?\./, '-*ENV*.');

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
                    message: form.label('Staging chatbot hostname', 'will set chatbot url in configuration files', true),
                    default: form.data.infrastructure === EXPRESS_AZURE
                        ? `${urlProjectName}-staging.azurewebsites.net`
                        : defaultDomain.replace('*ENV*', 'staging')
                }
            ]);

            if (form.data.infrastructure === SERVERLESS_AWS) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'stagingApiDomain',
                        message: form.label('Staging API hostname', 'domain of staging API Gateway endpoint', true),
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
                    message: form.label('Dev chatbot hostname', 'will set chatbot url in configuration files', true),
                    default: form.data.infrastructure === EXPRESS_AZURE ? `${urlProjectName}-dev.azurewebsites.net` : defaultDomain.replace('*ENV*', 'dev')
                }
            ]);

            if (form.data.infrastructure === SERVERLESS_AWS) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'devApiDomain',
                        message: form.label('Dev API hostname', 'domain of dev API Gateway endpoint', true),
                        default: form.data.devDomain.replace(/\./, '-api.')
                    }
                ]);
            }
        }

        if (form.data.testEnvironment) {
            await form.ask([
                {
                    type: 'input',
                    name: 'testDomain',
                    message: form.label('Test chatbot hostname', 'will set chatbot url in configuration files', true),
                    default: form.data.infrastructure === EXPRESS_AZURE ? `${urlProjectName}-test.azurewebsites.net` : defaultDomain.replace('*ENV*', 'test')
                }
            ]);

            if (form.data.infrastructure === SERVERLESS_AWS) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'testApiDomain',
                        message: form.label('Test API hostname', 'domain of test API Gateway endpoint', true),
                        default: form.data.testDomain.replace(/\./, '-api.')
                    }
                ]);
            }
        }

        if (form.data.infrastructure === SERVERLESS_AWS) {
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
                && [WINGBOT_ORCHESTRATOR, MESSENGER].includes(form.data.platform)) {

                await form.ask([
                    form.yesNo('notifications', form.label('Deploy Ads subsystem for Notifications'), Form.YES_NO)
                ]);
            }

            if (form.data.devEnvironment || form.data.testEnvironment) {
                await form.ask([
                    form.yesNo('useDifferentBotForDevTest', form.label('Want to use a different bot for DEV & TEST & DEVELOPMENT?'), Form.NO_YES)
                ]);
            }
            await form.ask([
                {
                    type: 'input',
                    name: 'languages',
                    message: form.label('List of configured languages, primary language should be first', 'comma separated (cs,en,sk) - keep empty, when languages are not configured', true)
                }
            ]);

            const { useDifferentBotForDevTest: twoBotIds } = form.data;

            await form.ask([
                {
                    type: 'input',
                    name: 'wingbotBotName',
                    message: form.group(
                        'Wingbot settings',
                        'We need to know wingbot connection data for every environment.\nBut you can skip these steps and fill these data later.\nYou can find all requested informations in "deployments" settings of your chatbot.',
                        form.label(`Wingbot bot name${twoBotIds ? ' for PRODUCTION & STAGING' : ''}`, 'you can fill it later into config/index.js', true)
                    ),
                    default: form.data.projectName
                },
                {
                    type: 'input',
                    name: 'wingbotBotId',
                    message: form.label(`Wingbot bot ID${twoBotIds ? ' for PRODUCTION & STAGING' : ''}`, 'you can fill it later into config/index.js', true)
                }
            ]);

            if (twoBotIds) {
                await form.ask([
                    {
                        type: 'input',
                        name: 'wingbotBotNameDevTest',
                        message: form.label('Wingbot bot name for DEV & TEST & DEVELOPMENT', 'you can fill it later', true),
                        default: form.data.projectName
                    },
                    {
                        type: 'input',
                        name: 'wingbotBotIdDevTest',
                        message: form.label('Wingbot bot ID for DEV & TEST & DEVELOPMENT', 'you can fill it later', true)
                    }
                ]);
            }

            await form.ask([
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
                        message: form.label('Wingbot "dev" snapshot token', 'you can fill it later into config/config.dev.js', true)
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
                        message: form.label('Wingbot "test" snapshot token', 'you can fill it later into config/config.test.js', true)
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
                    form.yesNo('anonymizeConversationLogs', form.label('Anonymize conversation logs', 'by passing anonymizer together with conversation logger to Sender', true), Form.YES_NO)
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
                            form.label('Production database name')
                        ),
                        name: 'mongodbName',
                        default: urlProjectName
                    },
                    {
                        type: 'input',
                        message: form.label('Production connection string', 'for production environment', true),
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
            case MSSQL: {
                if (!form.data.keyvault) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'MSSQL connection',
                                'you can fill these data later into config files, but it\'s recommended to keep connection string in ENV variables',
                                form.label('Database name')
                            ),
                            name: 'mssqlName',
                            default: urlProjectName
                        },
                        {
                            type: 'input',
                            message: form.label('Server name', 'for production environment', true),
                            name: 'mssqlServerName'
                        },
                        {
                            type: 'input',
                            message: form.label('Port', 'for production environment', true),
                            name: 'mssqlPort'
                        }
                    ]);

                    if (form.data.stagingEnvironment) {
                        await form.ask([
                            {
                                type: 'input',
                                message: form.label('Staging database name', 'for staging environment', true),
                                name: 'stagingMssqlName',
                                default: form.data.mssqlName
                            },
                            {
                                type: 'input',
                                message: form.label('Server name', 'for staging environment', true),
                                name: 'stagingMssqlServerName'
                            },
                            {
                                type: 'input',
                                message: form.label('Server name', 'for staging environment', true),
                                name: 'stagingMssqlServerName'
                            },
                            {
                                type: 'input',
                                message: form.label('Port', 'for staging environment', true),
                                name: 'stagingMssqlPort'
                            }
                        ]);
                    }

                    if (form.data.devEnvironment) {
                        await form.ask([
                            {
                                type: 'input',
                                message: form.label('Dev database name', 'for dev environment', true),
                                name: 'devMssqlName',
                                default: form.data.mssqlName
                            },
                            {
                                type: 'input',
                                message: form.label('Server name', 'for dev environment', true),
                                name: 'devMssqlServerName'
                            },
                            {
                                type: 'input',
                                message: form.label('Server name', 'for dev environment', true),
                                name: 'devMssqlServerName'
                            },
                            {
                                type: 'input',
                                message: form.label('Port', 'for dev environment', true),
                                name: 'devMssqlPort'
                            }
                        ]);
                    }

                    if (form.data.testEnvironment) {
                        await form.ask([
                            {
                                type: 'input',
                                message: form.label('Test database name', 'for test environment', true),
                                name: 'testMssqlName',
                                default: form.data.mssqlName
                            },
                            {
                                type: 'input',
                                message: form.label('Server name', 'for test environment', true),
                                name: 'testMssqlServerName'
                            },
                            {
                                type: 'input',
                                message: form.label('Server name', 'for test environment', true),
                                name: 'testMssqlServerName'
                            },
                            {
                                type: 'input',
                                message: form.label('Port', 'for test environment', true),
                                name: 'testMssqlPort'
                            }
                        ]);
                    }
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
                            form.label('Production database name', null, true)
                        ),
                        name: 'cosmosdbName'
                    },
                    {
                        type: 'input',
                        message: form.label('Production connection string', null, true),
                        name: 'cosmosdbConnectionString'
                    }
                ]);

                if (form.data.stagingEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Staging database name', null, true),
                            name: 'stagingCosmosdbName',
                            default: form.data.cosmosdbName
                        },
                        {
                            type: 'input',
                            message: form.label('Staging connection string', null, true),
                            name: 'stagingCosmosdbConnectionString',
                            default: form.data.cosmosdbConnectionString
                        }
                    ]);
                }

                if (form.data.devEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Dev database name', null, true),
                            name: 'devCosmosdbName',
                            default: form.data.cosmosdbName
                        },
                        {
                            type: 'input',
                            message: form.label('Dev connection string', null, true),
                            name: 'devCosmosdbConnectionString',
                            default: form.data.cosmosdbConnectionString
                        }
                    ]);
                }

                if (form.data.testEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Test database name', null, true),
                            name: 'testCosmosdbName',
                            default: form.data.cosmosdbName
                        },
                        {
                            type: 'input',
                            message: form.label('Test connection string', null, true),
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
            case WINGBOT_ORCHESTRATOR:
                await form.ask([
                    {
                        type: 'input',
                        message: form.group(
                            'Wingbot orchestrator settings - production',
                            'Put orchestrator configuration here.',
                            form.label('Orchestrator production hostname', 'Target orchestration url (keep empty, when using cloud orchestrator)', true)
                        ),
                        name: 'orchestratorProductionHostname',
                        default: null
                    },
                    {
                        type: 'input',
                        message: form.label('Production Orchestrator Page ID', 'Will be used as at bot\'s homepage for to show a chat. You can set it later.', true),
                        name: 'wingbotOrchestratorProductionPageId',
                        default: 'web'
                    },
                    {
                        type: 'input',
                        message: form.label('Production Orchestrator App ID', 'Will be used for communication with orchestrator', true),
                        name: 'wingbotOrchestratorProductionAppId',
                        default: 'bot0'
                    }
                ]);

                if (!form.data.keyvault) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.label('Production orchestrator secret', 'Secret for bot-orchestrator communication'),
                            name: 'wingbotOrchestratorProductionSecret'
                        }
                    ]);
                }

                if (form.data.stagingEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Wingbot orchestrator settings - staging',
                                'Put orchestrator configuration here.',
                                form.label('Orchestrator staging hostname', 'Target orchestration url (keep empty, when using cloud orchestrator)', true)
                            ),
                            name: 'orchestratorStagingHostname',
                            default: null
                        },
                        {
                            type: 'input',
                            message: form.label('Production Orchestrator Page ID', 'Will be used as at bot\'s homepage for to show a chat. You can set it later.', true),
                            name: 'wingbotOrchestratorStagingPageId',
                            default: 'web'
                        },
                        {
                            type: 'input',
                            message: form.label('Production Orchestrator App ID', 'Will be used for communication with orchestrator', true),
                            name: 'wingbotOrchestratorStagingAppId',
                            default: 'bot0'
                        }
                    ]);

                    if (!form.data.keyvault) {
                        await form.ask([
                            {
                                type: 'input',
                                message: form.label('Staging orchestrator secret', 'Secret for bot-orchestrator communication'),
                                name: 'wingbotOrchestratorStagingSecret'
                            }
                        ]);
                    }
                }

                if (form.data.devEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Wingbot orchestrator settings - dev',
                                'Put orchestrator configuration here.',
                                form.label('Orchestrator dev hostname', 'Target orchestration url (keep empty, when using cloud orchestrator)', true)
                            ),
                            name: 'orchestratorDevHostname',
                            default: null
                        },
                        {
                            type: 'input',
                            message: form.label('Production Orchestrator Page ID', 'Will be used as at bot\'s homepage for to show a chat. You can set it later.', true),
                            name: 'wingbotOrchestratorDevPageId',
                            default: 'web'
                        },
                        {
                            type: 'input',
                            message: form.label('Production Orchestrator App ID', 'Will be used for communication with orchestrator', true),
                            name: 'wingbotOrchestratorDevAppId',
                            default: 'bot0'
                        }
                    ]);

                    if (!form.data.keyvault) {
                        await form.ask([
                            {
                                type: 'input',
                                message: form.label('Dev orchestrator secret', 'Secret for bot-orchestrator communication'),
                                name: 'wingbotOrchestratorDevSecret'
                            }
                        ]);
                    }
                }

                if (form.data.testEnvironment) {
                    await form.ask([
                        {
                            type: 'input',
                            message: form.group(
                                'Wingbot orchestrator settings - test',
                                'Put orchestrator configuration here.',
                                form.label('Orchestrator test hostname', 'Target orchestration url (keep empty, when using cloud orchestrator)', true)
                            ),
                            name: 'orchestratorTestHostname',
                            default: null
                        },
                        {
                            type: 'input',
                            message: form.label('Production Orchestrator Page ID', 'Will be used as at bot\'s homepage for to show a chat. You can set it later.', true),
                            name: 'wingbotOrchestratorTestPageId',
                            default: 'web'
                        },
                        {
                            type: 'input',
                            message: form.label('Production Orchestrator App ID', 'Will be used for communication with orchestrator', true),
                            name: 'wingbotOrchestratorTestAppId',
                            default: 'bot0'
                        }
                    ]);

                    if (!form.data.keyvault) {
                        await form.ask([
                            {
                                type: 'input',
                                message: form.label('Test orchestrator secret', 'Secret for bot-orchestrator communication'),
                                name: 'wingbotOrchestratorTestSecret'
                            }
                        ]);
                    }
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
            case EXPRESS_AZURE:
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
                        form.label('Production GA4 tracking measurement ID')
                    ),
                    name: 'gaCode'
                },
                {
                    type: 'input',
                    message: form.label('Production GA4 API secret'),
                    name: 'gaSecret'
                }
            ]);

            if (form.data.stagingEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        message: form.label('Staging GA4 tracking measurement ID'),
                        name: 'gaCodeStaging'
                    },
                    {
                        type: 'input',
                        message: form.label('Staging GA4 API secret'),
                        name: 'gaSecretStaging'
                    }
                ]);
            }

            if (form.data.devEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        message: form.label('Dev GA4 tracking measurement ID'),
                        name: 'gaCodeDev'
                    },
                    {
                        type: 'input',
                        message: form.label('Dev GA4 API secret'),
                        name: 'gaSecretDev'
                    }
                ]);
            }

            if (form.data.testEnvironment) {
                await form.ask([
                    {
                        type: 'input',
                        message: form.label('Test GA4 tracking measurement ID'),
                        name: 'gaCodeTest'
                    },
                    {
                        type: 'input',
                        message: form.label('Test GA4 API secret'),
                        name: 'gaSecretTest'
                    }
                ]);
            }
        }

        formData = form.data;
    }

    try {
        const save = { ...formData, cliVersion: packageJson.version };
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

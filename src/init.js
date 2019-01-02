/*
 * @author David Menger
 */
'use strict';

const path = require('path');
const chalk = require('chalk');
const latestVersion = require('latest-version');
const fs = require('fs');
const spinAndCatch = require('./cli/spinAndCatch');
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
        'Azure Web Apps': EXPRESS_AZURE
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
    withDesigner: {
        'Use wingbot.ai designer (recommended)': 1,
        'I\'ll create bot programmatically': 0
    },
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
        isMongoOrCosmos: data[MONGODB] || data[AZURE_COSMOS_DB],
        isAwsOrAzure: data[SERVERLESS_AWS] || data[SERVERLESS_AZURE],
        isAzure: data[SERVERLESS_AZURE] || data[EXPRESS_AZURE],
        expressOrAppService: data[EXPRESS_AZURE] || data[EXPRESS],
        cosmosdbConnectionString: data.cosmosdbConnectionString
            ? data.cosmosdbConnectionString
                .replace(
                    /mongodb:\/\/[^:]+:[^@=]+(=+)/,
                    x => x.replace(/=+$/, z => encodeURIComponent(z))
                )
            : null,
        stagingCosmosdbConnectionString: data.stagingCosmosdbConnectionString
            ? data.stagingCosmosdbConnectionString
                .replace(
                    /mongodb:\/\/[^:]+:[^@=]+(=+)/,
                    x => x.replace(/=+$/, z => encodeURIComponent(z))
                )
            : null
    });
}

async function init () {

    // check the latest version
    try {
        const ver = await latestVersion('wingbot-cli');

        if (ver !== packageJson.version) {
            // eslint-disable-next-line no-console
            console.log(`\n${chalk.red('New version')} ${ver} ${chalk.red('of wingbot-cli has been released. Please update your wingbot CLI.')}\n`);
        }
    } catch (e) {
        // do not write nothing
    }

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

    form.data.jwtTokenSecret = previousData.jwtTokenSecret || (form.randomSha() + form.randomSha());

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
        form.list('withDesigner', form.label('Connect with wingbot.ai designer', 'for experimental purposes you can make a chatbot on your own'))
    ]);


    /**
     * publicStorage
     * domain
     * certificateArnStaging
     * certificateArnProduction
     */

    await form.ask([
        form.yesNo('publicStorage', form.group(
            'Chatbot application destination',
            'Make configuration ready for the application deployment',
            form.label('Chatbot will publish static website or assets', 'usefull for including image assets or having a test page for MS BotService')
        ), Form.NO_YES),
        {
            type: 'input',
            name: 'domain',
            message: form.label('Chatbot domain', 'will set chatbot url in configuration files as <chatbot>.<domain>', true),
            default: form.data.infrastructure === EXPRESS_AZURE ? 'azurewebsites.net' : undefined
        },
        {
            type: 'input',
            name: 'logzioToken',
            message: form.label('Logz.io token', 'Insert your token to be able to monitor your application. Keep empty to not set up a logging stack.', true)
        },
        form.yesNo('stagingEnvironment', form.label('Deploy staging environment', 'will prepare staging configuration'), Form.NO_YES)
    ]);

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
    }

    if (form.data.withDesigner) {
        if ([MONGODB, AZURE_COSMOS_DB].includes(form.data.database)
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
                default: form.randomSha() + form.randomSha() + form.randomSha() + form.randomSha()
            }
        ]);

        if (form.data.stagingEnvironment) {
            await form.ask([
                {
                    type: 'input',
                    name: 'wingbotStagingToken',
                    message: form.label('Wingbot "staging" snapshot token', 'you can fill it later into config/config.production.js', true)
                },
                {
                    type: 'input',
                    message: form.label('Staging API key', 'key used for accesing a chatbot API', true),
                    name: 'stagingApiToken',
                    default: form.randomSha() + form.randomSha()
                }
            ]);
        }
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
                        message: form.label('Facebook Page ID', 'you can find it at settings of the desired FB page', true),
                        name: 'fbPageIdStaging'
                    },
                    {
                        type: 'input',
                        message: form.label('Facebook App Secret', 'you can find it at FB developers portal', true),
                        name: 'fbAppSecretStaging'
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
    }


    try {
        const save = Object.assign({}, form.data, { cliVersion: packageJson.version });
        fs.writeFileSync(inputsStorage, JSON.stringify(save));
    } catch (e) {
        // noop
    }
    const root = path.resolve(__dirname, path.join('..', 'templates'));

    const data = preprocessData(form.data);
    const tr = new TemplateRenderer(root, destination, data);

    await spinAndCatch(() => tr.render());

    log(`\n${chalk.green.bold('Your project is ready!')}\n\n${chalk.white('do not forget to run')} ${chalk.magenta('npm install')}`);
    log(`${chalk.white('do not forget to set')} ${chalk.magenta('NODE_ENV = production')} ${chalk.white('on production environment')}`);
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

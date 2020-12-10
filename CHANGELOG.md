# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.2] - 10.12.2020
### Fixed
- removed anonymize from the bot.js
- small bug fixes related to languages
## [3.2.1] - 2020-12-4
### Fixed
- support for cosmodb fixes
- updated wingbot libs
- large wiki file support

## [3.2.0] - 2020-11-29

### Added
- posibility to connect one bot to two workspaces
- basic support for multilanguage NLPs

### Fixed
- serverless orchestrator config
- dev & test environments logic & npm scripts

### Fixed
- node modules for bot
- timeout of a lambda function for wingbot orchestrator bots
- wikiToText has right description


## [3.1.3] - 2020-11-12

### Added
- training data stats for wikiToText
### Fixed
- node modules for bot
- timeout of a lambda function for wingbot orchestrator bots
- wikiToText has right description

### Changed
- updated homepage of a bot
- added an orchestrator frontend chat code
- more straightforward way to fill DB data
- suport for google credentials in JSON

### Fixed
- lot of issues in tests :)

## [3.1.1] - 2020-11-12

### Added
- wingbot orchestrator option

### Changed
- updated node modules
- disabled other than azure environments for webchat

### Fixed
- lot of issues in tests :)

## [3.0.0] - 2020-05-22
### Added
- [WIN-9] Bot's admins are able to copy workspaces from the Settings screen.
- Support for Sentry monitoring service
- Support for MS Azure Application Insights service
- New webchat option for a bot
- Support for MS Azure keyvaut key storage
- Option create dev and test environment
- Add support for MSSQL DB for MS Azure platform
- Update of Google analytics plugin
- connector for conversation testing
- update Google Sheet Storage for Test Cases

### Fixed
- bot.js clean up
# Wingbot.ai CLI

CLI tool for wingbot.AI
Tools for processing intents from RASA JSONs to Facebook fast-text learning sets.

Because there is good GUI: [Rasa NLU Trainer](https://rasahq.github.io/rasa-nlu-trainer/)

## Create wingbot project

Install wingbot.ai CLI

```bash
$ npm i -g wingbot-cli
```

Create a new project

```bash
$ mkdir my-bot
$ cd my-bot
$ wingbot init
```

![wingbot init command](https://github.com/wingbotai/wingbot/raw/master/doc/wingbotInit.png "Wingbot Init Command")

## Log in to wingbot.ai

  - **Log in to Wingbot**

```bash
$ wingbot login
```

## Learning set tools

  - **Convert RASA json to fast-text learning set**

```bash
$ wingbot jsonToText ./testData.json ./testData.txt
```

  - **Convert RASA json to fast-text learning set and multiply by entities**

```bash
$ wingbot jsonToText -m ./testData.json ./testData.txt
```

  - **Make word vectors learning set from wiki XML export**

```bash
$ wingbot wikiToText ./testData.xml ./testData.txt
```

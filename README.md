# Wingbot.ai CLI

CLI tool for wingbot.AI

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

## Update wingbot project

```bash
$ wingbot update
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

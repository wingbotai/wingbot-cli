/*
 * @author David Menger
 */
'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const handlebars = require('handlebars');

class TemplateRenderer {

    constructor (templateRoot, destination, data = {}) {
        this.templateRoot = templateRoot;
        this.destination = destination;

        this.data = Object.assign({
            projectName: path.basename(destination)
        }, data);
    }

    _readFiles () {
        const globOptions = {
            root: this.templateRoot,
            cwd: this.templateRoot,
            dot: true
        };

        return new Promise((resolve, reject) => {
            glob('**/@(*.hbs.*|*.hbs)', globOptions, (err, matches) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(matches);
                }
            });
        });
    }

    _fileExists (fileName) {
        return new Promise((resolve, reject) => {
            fs.access(fileName, fs.constants.W_OK, (err) => {
                if (!err) {
                    resolve(true);
                } else if (err && err.code === 'ENOENT') {
                    resolve(false);
                } else {
                    reject(err);
                }
            });
        });
    }

    _createDirectory (dir) {
        return new Promise((resolve) => {
            fs.mkdir(dir, resolve);
        });
    }


    _ensureDirExists (fileName) {
        const dir = path.dirname(fileName);

        return this._fileExists(dir)
            .then((exists) => {
                if (exists) {
                    return true;
                }

                return this._ensureDirExists(dir)
                    .then(() => this._createDirectory(dir));
            });
    }

    _readFile (fileName) {
        return new Promise((resolve, reject) => {
            fs.readFile(fileName, 'utf8', (err, contents) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(contents);
                }
            });
        });
    }

    _writeFile (fileName, contents) {
        return new Promise((resolve, reject) => {
            fs.writeFile(fileName, contents, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    _renderFile (fileName) {
        const sourceFile = path.join(this.templateRoot, fileName);
        const destFile = path.join(this.destination, fileName.replace(/\.hbs(\.|$)/, '$1'));

        return this._readFile(sourceFile)
            .then((template) => {
                const renderer = handlebars.compile(template);
                let contents;
                try {
                    contents = renderer(this.data);
                } catch (e) {
                    console.error(`Rendering failed in ${fileName}`); // eslint-disable-line no-console
                    throw e;
                }

                // skip empty files
                if (contents.length < 20 && !contents.trim()) {
                    return null;
                }

                return this._ensureDirExists(destFile)
                    .then(() => this._writeFile(destFile, contents));
            });
    }

    render () {
        return this._readFiles()
            .then(files => Promise.all(files
                .map(fileName => this._renderFile(fileName))));
    }

}

module.exports = TemplateRenderer;

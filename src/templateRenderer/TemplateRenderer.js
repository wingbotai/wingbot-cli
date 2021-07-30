/*
 * @author David Menger
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const handlebars = require('handlebars');

const CARRET_REGEX = /^\^[0-9]+\.[0-9]+\.[0-9a-z\-_]+$/;
class TemplateRenderer {

    constructor (templateRoot, destination, data = {}) {
        this.templateRoot = templateRoot;
        this.destination = destination;

        this.data = { projectName: path.basename(destination), ...data };

        this._originalHashes = {};
        this._writtenHashes = {};
        this._skipLogged = false;
    }

    _readFiles (globPattern) {
        const globOptions = {
            root: this.templateRoot,
            cwd: this.templateRoot,
            dot: true
        };

        return new Promise((resolve, reject) => {
            glob(globPattern, globOptions, (err, matches) => {
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

    _readBufferFile (fileName) {
        return new Promise((resolve, reject) => {
            fs.readFile(fileName, (err, contents) => {
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
                } else if (fileName.match(/\/bin\/[a-z.]+$/)) {
                    fs.chmod(fileName, 0o754, (error) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    _mergeDependencies (orig, updated) {
        if (!orig) {
            return updated;
        }
        Object.keys(updated)
            .forEach((key) => {
                if (typeof orig[key] !== 'string' || orig[key].match(CARRET_REGEX)) {
                    // update

                    Object.assign(orig, { [key]: updated[key] });
                }
            });
        return orig;
    }

    _mergePackageJson (original, rendered) {
        const orig = JSON.parse(original);
        const upd = JSON.parse(rendered);

        if (upd.dependencies) {
            Object.assign(orig, {
                dependencies: this._mergeDependencies(orig.dependencies, upd.dependencies)
            });
        }
        if (upd.devDependencies) {
            Object.assign(orig, {
                devDependencies: this._mergeDependencies(orig.devDependencies, upd.devDependencies)
            });
        }
        return JSON.stringify(orig, undefined, 2);
    }

    _writeFileIfNotChanged (destFile, destFileName, contents) {
        /**
         * 1. file exists and has not been changed or there is no hash = write
         * 2. file exists and has been changed = just update the hash
         * 3. file not exists, but there is a hash (probably has been removed) = same as 2
         * 4. file not exists and there's also no hash = write
         */

        let removed = false;
        let originalFileContents;

        return this._readFile(destFile)
            .then((originalContents) => {
                originalFileContents = originalContents;

                // original file exists, calculate the hash
                const h = crypto.createHash('sha256');
                h.update(originalContents);
                return h.digest('base64');
            })
            .catch(() => null)
            .then((originalHash) => {
                if (!originalHash && this._originalHashes[destFileName]) {
                    // 3. file not exists, but there is a hash (probably has been removed)
                    removed = true;
                    return false;
                }
                if (!originalHash) {
                    // 4. file not exists and there's also no hash = write
                    return true;
                }
                if (originalHash === this._originalHashes[destFileName]
                    || !this._originalHashes[destFileName]) {

                    // 1. file exists and has not been changed or there is no hash
                    return true;
                }

                // 2. file exists and has been changed = just update the hash
                return false;
            })
            .then((write) => {
                // first save new file hash
                const h = crypto.createHash('sha256');
                h.update(contents);
                this._writtenHashes[destFileName] = h.digest('base64');

                if (write) {
                    return this._writeFile(destFile, contents);
                }

                if (!this._skipLogged) {
                    this._skipLogged = true;
                    console.log('\nSkipping modified files (edit or remove wingbot-files.json to update files):'); // eslint-disable-line no-console
                }

                if (destFileName === 'package.json' && originalFileContents) {
                    // there'll be merge
                    console.log(` - ${destFileName} (merged with old one)`); // eslint-disable-line no-console
                    const mergedFile = this._mergePackageJson(originalFileContents, contents);
                    return this._writeFile(destFile, mergedFile);
                }

                console.log(` - ${destFileName}${removed ? ' (not exists)' : ''}`); // eslint-disable-line no-console
                return null;
            });
    }

    _copyFile (fileName) {
        const conditionFileName = fileName.match(/^(.+)\.([a-z0-9]+)\.([a-z0-9]+)$/i);

        let destFileName;
        if (conditionFileName) {
            const [, file, condition, ext] = conditionFileName;

            if (!this.data[condition]) {
                return Promise.resolve();
            }

            destFileName = `${file}.${ext}`;
        } else {
            destFileName = fileName;
        }

        const sourceFile = path.join(this.templateRoot, fileName);
        const destFile = path.join(this.destination, destFileName);

        return this._readBufferFile(sourceFile)
            .then((contents) => this._ensureDirExists(destFile)
                .then(() => this._writeFile(destFile, contents)));
    }

    _renderFile (fileName) {
        const sourceFile = path.join(this.templateRoot, fileName);
        const destFileName = fileName.replace(/\.hbs(\.|$)/, '$1');
        const destFile = path.join(this.destination, destFileName);

        return this._readFile(sourceFile)
            .then((template) => {
                if (fileName.match(/\.hbs\.hbs$/)) {
                    return this._ensureDirExists(destFile)
                        .then(() => this._writeFileIfNotChanged(destFile, destFileName, template));
                }
                const renderer = handlebars.compile(template);
                let contents;
                try {
                    contents = renderer(this.data);

                    // trim jsons to have no space at the end
                    if (destFileName.match(/\.json$/)) {
                        contents = contents.trim();
                    }
                } catch (e) {
                    console.error(`Rendering failed in ${fileName}`); // eslint-disable-line no-console
                    throw e;
                }

                // skip empty files
                if (contents.length < 20 && !contents.trim()) {
                    return null;
                }

                return this._ensureDirExists(destFile)
                    .then(() => this._writeFileIfNotChanged(destFile, destFileName, contents));
            });
    }

    _loadHashFile () {
        const hashFilePath = path.join(this.destination, 'wingbot-files.json');
        return this._readFile(hashFilePath)
            .then((contents) => JSON.parse(contents))
            .catch(() => ({}))
            .then((hashes) => {
                this._originalHashes = hashes;
            });
    }

    _saveHashFile () {
        const hashes = Object.keys(this._writtenHashes)
            .map((key) => [key, this._writtenHashes[key]])
            .sort((a, b) => {
                const aSlash = a[0].match(/\//);
                const bSlash = b[0].match(/\//);
                if (aSlash && !bSlash) {
                    return -1;
                }
                if (!aSlash && bSlash) {
                    return 1;
                }
                return a[0] > b[0] ? 1 : -1;
            })
            .reduce((o, [key, val]) => Object.assign(o, { [key]: val }), {});

        const hashFilePath = path.join(this.destination, 'wingbot-files.json');
        return this._writeFile(hashFilePath, JSON.stringify(hashes, undefined, 2));
    }

    render () {
        return Promise.all([
            this._readFiles('**/@(*.hbs.*|*.hbs)'),
            this._readFiles('**/@(*.*.png|*.*.jpg|*.*.jpeg|*.svg|*.png|*.jpg|*.jpeg|*.svg)'),
            this._loadHashFile()
        ])
            .then(([files, otherFiles]) => Promise.all([
                ...files
                    .map((fileName) => this._renderFile(fileName)),
                ...otherFiles
                    .map((fileName) => this._copyFile(fileName))
            ]))
            .then(() => this._saveHashFile());
    }

}

module.exports = TemplateRenderer;

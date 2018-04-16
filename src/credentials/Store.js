/*
 * @author David Menger
 */
'use strict';

const fs = require('fs');
const path = require('path');

function promise (fn) {
    return new Promise((resolve, reject) => {
        fn((err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

class Store {

    constructor (dir, file) {
        this.dir = dir;
        this.file = file;
        this.data = null;
    }

    _filename () {
        return path.join(this.dir, this.file);
    }

    loadData () {
        if (this.data !== null) {
            return this.data;
        }

        try {
            const data = fs.readFileSync(this._filename(), 'utf8');
            this.data = JSON.parse(data);
        } catch (e) {
            this.data = {};
        }

        return this.data;
    }

    _saveData (data) {
        const configFile = this._filename();

        return promise(cb => fs.writeFile(configFile, data, cb))
            .catch(() => {
                throw new Error(`Can't write to ${configFile}`);
            });
    }

    saveData (data) {
        this.data = data;
        const serialized = JSON.stringify(data);

        return this._saveData(serialized)
            .catch(() => promise(cb => fs.mkdir(this.dir, cb))
                .then(() => this._saveData(serialized)));
    }

    updateData (data) {
        const current = this.loadData();
        const updated = Object.assign({}, current, data);
        return this._saveData(JSON.stringify(updated));
    }

}

module.exports = Store;

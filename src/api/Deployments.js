/*
 * @author David Menger
 */
'use strict';

const request = require('request-promise-native');

class Deployments {

    constructor (host) {
        this.host = host;
    }

    _createDeployment (token, id) {
        const req = {
            url: `${this.host}/deployments`,
            method: 'POST',
            json: true,
            headers: {
                Authentication: token
            },
            body: {
                id
            }
        };

        return request(req);
    }

    _uploadFile (url, fields, file) {
        const formData = { ...fields, file };
        return request({
            url,
            method: 'POST',
            formData
        });
    }

    deploy (token, id, file) {
        return this._createDeployment(token, id)
            .then((res) => this._uploadFile(res.uploadUrl.url, res.uploadUrl.fields, file));
    }

    list (token) {
        const req = {
            url: `${this.host}/deployments`,
            qs: {
                limit: 1000
            },
            method: 'GET',
            json: true,
            headers: {
                Authentication: token
            }
        };

        return request(req);
    }

    remove (token, id) {
        const req = {
            url: `${this.host}/deployments/${id}`,
            method: 'DELETE',
            json: true,
            headers: {
                Authentication: token
            }
        };

        return request(req);
    }

}

module.exports = Deployments;

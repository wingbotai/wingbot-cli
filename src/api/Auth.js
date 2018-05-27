/*
 * @author David Menger
 */
'use strict';

const request = require('request-promise-native');

class Auth {

    constructor (host) {
        this.host = host;
    }

    login (email, password) {
        return request({
            url: `${this.host}/login`,
            method: 'POST',
            json: true,
            body: {
                email, password
            }
        }).catch((e) => {
            const res = e.response;
            if (!res || !res.body || !res.body.code) {
                throw e;
            }

            switch (res.body.code) {
                case 404:
                    throw new Error('User not found');
                case 401:
                    throw new Error('Password missmatch');
                case 400:
                    throw new Error('Bad data');
                default:
                    throw new Error(res.body.error || res.body.message);
            }
        });
    }
}

module.exports = Auth;

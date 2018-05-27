/*
 * @author David Menger
 */
'use strict';

const spinner = require('./spinner');

async function spinAndCatch (fn) {
    const s = spinner();
    try {
        s.start();
        return await fn(s);
    } finally {
        s.stop(true);
    }
}

module.exports = spinAndCatch;

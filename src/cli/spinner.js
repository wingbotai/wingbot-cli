/*
 * @author David Menger
 */
'use strict';

const { Spinner } = require('cli-spinner');

module.exports = function spinner () {
    const spin = new Spinner({
        text: ' ',
        stream: process.stderr,
        onTick (msg) {
            this.clearLine(this.stream);
            this.stream.write(msg);
        }
    });
    spin.setSpinnerString('⣾⣽⣻⢿⡿⣟⣯⣷');
    return spin;
};

/*
 * @author David Menger
 */
'use strict';

const os = require('os');
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');

function compressAndStream (fromFileStream, onProgress) {
    const tmpFile = path.join(os.tmpdir(), `upload-${Date.now()}.zip`);

    onProgress('compressing...');

    const writeTo = fs.createWriteStream(tmpFile);

    fromFileStream.pipe(zlib.createGzip({
        level: 5
    })).pipe(writeTo);

    return new Promise((resolve) => {
        writeTo.once('close', () => {

            fs.stat(tmpFile, (err, stats) => {
                const read = fs.createReadStream(tmpFile);

                const { size } = stats;

                onProgress(`uploading ${Math.round(size / 1048576)} MB`);

                /*
                let uploadedSize = 0; // Incremented by on('data') to keep track

                read.on('data', (buffer) => {
                    const segmentLength = buffer.length;

                    // Increment the uploaded data counter
                    uploadedSize += segmentLength;

                    // Display the upload percentage
                    onProgress(`uploading ${Math.round(size / 1048576)} MB -
                        ${((uploadedSize / size) * 100).toFixed(2)}%`);
                });
                */

                read.once('close', () => {
                    onProgress('removing temporary file...');
                    fs.unlink(tmpFile, (er) => {
                        if (er) {
                            console.error(er); // eslint-disable-line
                        } else {
                            onProgress('temporary file removed, waiting for confirmation...');
                        }
                    });
                });

                resolve(read);
            });
        });
    });
}

module.exports = compressAndStream;

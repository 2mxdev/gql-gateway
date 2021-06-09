"use strict";

const form_data = require("form-data");
class FormData extends form_data {
    /*
      This is a workaround to make node-fetch to work properly
      with unknown length streams, which was not released yet.
      https://github.com/node-fetch/node-fetch/pull/707
     */
    getLength(callback) {
        const cb = (err, length) => {
            if (err || !Number.isNaN(length)) {
                callback(err, length);
            }
            else {
                callback(null, null);
            }
        };
        super.getLength(cb);
    }
    getLengthSync() {
        const len = super.getLengthSync();
        return Number.isNaN(len) ? null : len;
    }
}
module.exports = FormData;

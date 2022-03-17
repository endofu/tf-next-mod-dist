"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findEntryPoint = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
// Looks for a `package.json` or `next.config.js` file in cwd and
// returns the result as a relative path to the basePath
function findEntryPoint(cwd) {
    for (const entrypoint of ['package.json', 'next.config.js']) {
        if ((0, fs_1.existsSync)((0, path_1.join)(cwd, entrypoint))) {
            return entrypoint;
        }
    }
    throw new Error(`No package.json or next.config.js could be found in ${cwd}`);
}
exports.findEntryPoint = findEntryPoint;

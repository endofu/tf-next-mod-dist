"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeRoutesByPrefix = void 0;
/**
 * Given an array of routes we filter routes out that start with
 * - `prefix`
 * - `/prefix`
 * - `^prefix`
 * - `^/prefix`
 */
function removeRoutesByPrefix(routes, prefix) {
    // https://stackoverflow.com/a/35478115/831465
    const escapedPrefix = prefix.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
    const matcher = new RegExp(`^\\^?\\/?\\/${escapedPrefix}`);
    return routes.filter(({ src }) => {
        if (src && src.match(matcher)) {
            return false;
        }
        return true;
    });
}
exports.removeRoutesByPrefix = removeRoutesByPrefix;

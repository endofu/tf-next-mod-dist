"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
yargs_1.default.command('build', 'Build the next.js project', (yargs_) => {
    return yargs_
        .option('skipDownload', {
        type: 'boolean',
        description: 'Runs the build in the current working directory',
    })
        .option('verbose', {
        type: 'boolean',
        description: 'Run with verbose logging',
    });
}, async ({ skipDownload, verbose }) => {
    const cwd = process.cwd();
    (await Promise.resolve().then(() => __importStar(require('./commands/build')))).default({
        skipDownload,
        logLevel: verbose ? 'verbose' : 'none',
        cwd,
    });
}).argv;

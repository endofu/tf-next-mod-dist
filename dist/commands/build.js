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
const tmp_1 = __importDefault(require("tmp"));
const tf_next_runtime_1 = require("@millihq/tf-next-runtime");
const build_utils_1 = require("@vercel/build-utils");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const archiver_1 = __importDefault(require("archiver"));
const util = __importStar(require("util"));
const find_yarn_workspace_root_1 = __importDefault(require("find-yarn-workspace-root"));
const routes_1 = require("../utils/routes");
const utils_1 = require("../utils");
// Config file version (For detecting incompatibility issues in Terraform)
// See: https://github.com/dealmore/terraform-aws-next-js/issues/5
const TF_NEXT_VERSION = 1;
async function checkoutFiles(basePath, targetPath) {
    const files = await (0, build_utils_1.glob)('**', {
        cwd: basePath,
        ignore: [
            '**/node_modules/**',
            '**/.next/**',
            '**/.next-tf/**',
            '**/.git/**',
        ],
    });
    return (0, build_utils_1.download)(files, targetPath);
}
function normalizeRoute(input) {
    return input.replace(/\/index$/, '/');
}
function writeStaticWebsiteFiles(outputFile, files) {
    return new Promise(async (resolve, reject) => {
        // Create a zip package for the static website files
        const output = fs.createWriteStream(outputFile);
        const archive = (0, archiver_1.default)('zip', {
            zlib: { level: 9 },
        });
        archive.pipe(output);
        output.on('close', function () {
            console.log(archive.pointer() + ' total bytes');
            resolve();
        });
        archive.on('error', (err) => {
            reject(err);
        });
        for (const [key, file] of Object.entries(files)) {
            const buf = await (0, build_utils_1.streamToBuffer)(file.toStream());
            archive.append(buf, { name: key });
        }
        archive.finalize();
    });
}
function writeOutput(props) {
    const config = {
        lambdas: {},
        staticRoutes: [],
        routes: props.routes,
        buildId: props.buildId,
        prerenders: props.prerenders,
        staticFilesArchive: 'static-website-files.zip',
        version: TF_NEXT_VERSION,
        images: props.images,
    };
    for (const [key, lambda] of Object.entries(props.lambdas)) {
        const zipFilename = path.join(props.outputDir, 'lambdas', `${key}.zip`);
        fs.outputFileSync(zipFilename, lambda.zipBuffer);
        const route = `/${key}`;
        config.lambdas[key] = {
            handler: lambda.handler,
            runtime: lambda.runtime,
            filename: path.relative(props.outputDir, zipFilename),
            route: normalizeRoute(route),
        };
    }
    config.staticRoutes = Object.keys(props.staticWebsiteFiles)
        .map((fullFilePath) => 
    // On Windows make sure that the `\` in the filepath is replaced with `/`
    fullFilePath.split(path.sep).join(path.posix.sep))
        .filter(
    // Remove paths that are not routed from the proxy
    // - _next/static/ -> Is routed directly by CloudFront
    (fullFilePath) => !fullFilePath.startsWith('_next/static/'))
        // Add leading / to the route
        .map((fullFilePath) => `/${fullFilePath}`);
    const staticFilesArchive = writeStaticWebsiteFiles(path.join(props.outputDir, config.staticFilesArchive), props.staticWebsiteFiles);
    // Write config.json
    const writeConfig = fs.outputJSON(path.join(props.outputDir, 'config.json'), config, {
        spaces: 2,
    });
    return Promise.all([writeConfig, staticFilesArchive]);
}
async function buildCommand({ skipDownload = false, logLevel, deleteBuildCache = true, cwd, target = 'AWS', }) {
    let buildOutput = null;
    const mode = skipDownload ? 'local' : 'download';
    // On download create a tmp dir where the files can be downloaded
    const tmpDir = mode === 'download'
        ? tmp_1.default.dirSync({ unsafeCleanup: deleteBuildCache })
        : null;
    const workspaceRoot = (0, find_yarn_workspace_root_1.default)(cwd);
    const repoRootPath = workspaceRoot !== null && workspaceRoot !== void 0 ? workspaceRoot : cwd;
    const relativeWorkPath = path.relative(repoRootPath, cwd);
    const workPath = mode === 'download' ? path.join(tmpDir.name, relativeWorkPath) : cwd;
    const outputDir = path.join(cwd, '.next-tf');
    // Ensure that the output dir exists
    fs.ensureDirSync(outputDir);
    if (mode === 'download') {
        console.log('Checking out files...');
        await checkoutFiles(repoRootPath, tmpDir.name);
    }
    try {
        // Entrypoint is the path to the `package.json` or `next.config.js` file
        // from repoRootPath
        const entrypoint = (0, utils_1.findEntryPoint)(workPath);
        const lambdas = {};
        const prerenders = {};
        const staticWebsiteFiles = {};
        const buildResult = await (0, tf_next_runtime_1.build)({
            // files normally would contain build cache
            files: {},
            workPath,
            repoRootPath: mode === 'download' ? tmpDir.name : repoRootPath,
            entrypoint,
            config: { sharedLambdas: true, maxLambdaSize: 250 * 1000 * 1000 },
            meta: {
                isDev: false,
                // @ts-ignore
                skipDownload,
            },
        });
        // Get BuildId
        // TODO: Should be part of buildResult since it's already there
        const entryDirectory = path.dirname(entrypoint);
        const entryPath = path.join(workPath, entryDirectory);
        const buildId = await fs.readFile(path.join(entryPath, '.next', 'BUILD_ID'), 'utf8');
        for (const [key, file] of Object.entries(buildResult.output)) {
            switch (file.type) {
                case 'Lambda': {
                    lambdas[key] = file;
                    break;
                }
                case 'Prerender': {
                    prerenders[key] = file;
                    break;
                }
                case 'FileFsRef': {
                    staticWebsiteFiles[key] = file;
                    break;
                }
            }
        }
        // Build the mapping for prerendered routes
        const prerenderedOutput = {};
        for (const [key, prerender] of Object.entries(prerenders)) {
            // Find the matching the Lambda route
            const match = Object.entries(lambdas).find(([, lambda]) => {
                return lambda === prerender.lambda;
            });
            if (match) {
                const [lambdaKey] = match;
                prerenderedOutput[`/${key}`] = { lambda: lambdaKey };
            }
        }
        // Routes that are not handled by the AWS proxy module `_next/static/*` are filtered out
        // for better performance
        const optimizedRoutes = target === 'AWS'
            ? (0, routes_1.removeRoutesByPrefix)(buildResult.routes, '_next/static/')
            : buildResult.routes;
        buildOutput = {
            buildId,
            prerenders: prerenderedOutput,
            routes: optimizedRoutes,
            lambdas,
            staticWebsiteFiles,
            outputDir: outputDir,
            images: buildResult.images,
        };
        await writeOutput(buildOutput);
        if (logLevel === 'verbose') {
            console.log(util.format('Routes:\n%s', JSON.stringify(optimizedRoutes, null, 2)));
        }
        console.log('Build successful!');
    }
    catch (err) {
        console.log('Build failed:');
        console.error(err);
        // If an error occurs make the task fail
        process.exitCode = 1;
    }
    // Cleanup tmpDir
    if (tmpDir && deleteBuildCache) {
        tmpDir.removeCallback();
    }
    return buildOutput;
}
exports.default = buildCommand;

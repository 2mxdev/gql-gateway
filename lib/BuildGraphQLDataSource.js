"use strict";
const gateway = require("@apollo/gateway");
const apollo_server_env = require("apollo-server-env");
const predicates = require("@apollo/gateway/dist/utilities/predicates");
const lodash_clonedeep = __importDefault(require("lodash.clonedeep"));
const lodash_set = __importDefault(require("lodash.set"));
const FormData = __importDefault(require("./FormData"));
class BuildGraphQLDataSource  extends gateway.RemoteGraphQLDataSource {
    willSendRequest({ request, context }) {
        if(context.user != undefined && context.user.iss != undefined){
            let user = context.user
            request.http.headers.set('x-user-id', context.user.iss);
            request.http.headers.set('x-user', Buffer.from(JSON.stringify(user)).toString('base64'));
          }
          request.http.headers.set('x-token', context.token); 
       }
    static extractFileVariables(rootVariables) {
        const extract = (variables, prefix) => {
            return Object.entries(variables || {}).reduce((acc, [name, value]) => {
                const p = prefix ? `${prefix}.` : '';
                const key = `${p}${name}`;
                if (value instanceof Promise) {
                    acc.push([key, value]);
                    return acc;
                }
                if (Array.isArray(value)) {
                    const [first] = value;
                    if (first instanceof Promise) {
                        return acc.concat(value.map((v, idx) => [
                            `${key}.${idx}`,
                            v,
                        ]));
                    }
                    if (predicates.isObject(first)) {
                        return acc.concat(...value.map((v, idx) => extract(v, `${key}.${idx}`)));
                    }
                    return acc;
                }
                if (predicates.isObject(value)) {
                    return acc.concat(extract(value, key));
                }
                return acc;
            }, []);
        };
        return extract(rootVariables);
    }
    process(args) {
        const _super = Object.create(null, {
            process: { get: () => super.process }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const fileVariables = BuildGraphQLDataSource.extractFileVariables(args.request.variables);
            if (fileVariables.length > 0) {
                return this.processFiles(args, fileVariables);
            }
            return _super.process.call(this, args);
        });
    }
    processFiles(args, fileVariables) {
        return __awaiter(this, void 0, void 0, function* () {
            const { context, request } = args;
            const form = new FormData.default();
            const variables = lodash_clonedeep.default(request.variables || {});
            fileVariables.forEach(([variableName]) => {
                lodash_set.default(variables, variableName, null);
            });
            const operations = JSON.stringify({
                query: request.query,
                variables,
            });
            form.append('operations', operations);
            const fileMap = {};
            const resolvedFiles = yield Promise.all(fileVariables.map(([variableName, file], i) => __awaiter(this, void 0, void 0, function* () {
                const fileUpload = yield file;
                fileMap[i] = [`variables.${variableName}`];
                return fileUpload;
            })));
            // This must come before the file contents append bellow
            form.append('map', JSON.stringify(fileMap));
            resolvedFiles.forEach(({ createReadStream, filename, mimetype: contentType }, i) => {
                form.append(i.toString(), createReadStream(), {
                    contentType,
                    filename,
                    /*
                        Set knownLength to NaN so node-fetch does not set the
                        Content-Length header and properly set the enconding
                        to chunked.
                        https://github.com/form-data/form-data/pull/397#issuecomment-471976669
                    */
                    knownLength: Number.NaN,
                });
            });
            const headers = (request.http && request.http.headers) || new apollo_server_env.Headers();
            Object.entries(form.getHeaders() || {}).forEach(([k, value]) => {
                headers.set(k, value);
            });
            request.http = {
                headers,
                method: 'POST',
                url: this.url,
            };
            if (this.willSendRequest) {
                yield this.willSendRequest(args);
            }
            const options = Object.assign(Object.assign({}, request.http), { 
                // Apollo types are not up-to-date, make TS happy
                body: form });
            const httpRequest = new apollo_server_env.Request(request.http.url, options);
            let httpResponse;
            try {
                httpResponse = yield this.fetcher(httpRequest);
                const body = yield this.parseBody(httpResponse);
                if (!predicates.isObject(body)) {
                    throw new Error(`Expected JSON response body, but received: ${body}`);
                }
                const response = Object.assign(Object.assign({}, body), { http: httpResponse });
                if (typeof this.didReceiveResponse === 'function') {
                    return this.didReceiveResponse({ context, request, response });
                }
                return response;
            }
            catch (error) {
                this.didEncounterError(error, httpRequest, httpResponse);
                throw error;
            }
        });
    }
}
module.exports = BuildGraphQLDataSource;

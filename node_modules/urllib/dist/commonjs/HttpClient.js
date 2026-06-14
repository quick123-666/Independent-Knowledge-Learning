"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = exports.channels = exports.HEADER_USER_AGENT = exports.VERSION = exports.PROTO_RE = void 0;
const node_diagnostics_channel_1 = __importDefault(require("node:diagnostics_channel"));
const node_events_1 = require("node:events");
const node_fs_1 = require("node:fs");
const node_http_1 = require("node:http");
const node_path_1 = require("node:path");
const node_perf_hooks_1 = require("node:perf_hooks");
const node_querystring_1 = __importDefault(require("node:querystring"));
const node_stream_1 = require("node:stream");
const promises_1 = require("node:stream/promises");
const promises_2 = require("node:timers/promises");
const node_url_1 = require("node:url");
const node_util_1 = require("node:util");
const node_zlib_1 = require("node:zlib");
// Compatible with old style formstream
const formstream_1 = __importDefault(require("formstream"));
const mime_types_1 = __importDefault(require("mime-types"));
const qs_1 = __importDefault(require("qs"));
const undici_1 = require("undici");
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const symbols_js_1 = __importDefault(require("undici/lib/core/symbols.js"));
const diagnosticsChannel_js_1 = require("./diagnosticsChannel.js");
const FormData_js_1 = require("./FormData.js");
const HttpAgent_js_1 = require("./HttpAgent.js");
const HttpClientError_js_1 = require("./HttpClientError.js");
const symbols_js_2 = __importDefault(require("./symbols.js"));
const utils_js_1 = require("./utils.js");
exports.PROTO_RE = /^https?:\/\//i;
function noop() {
    // noop
}
const debug = (0, node_util_1.debuglog)('urllib:HttpClient');
exports.VERSION = '4.9.0';
// 'node-urllib/4.0.0 Node.js/18.19.0 (darwin; x64)'
exports.HEADER_USER_AGENT = `node-urllib/${exports.VERSION} Node.js/${process.version.substring(1)} (${process.platform}; ${process.arch})`;
function getFileName(stream) {
    const filePath = stream.path;
    if (filePath) {
        return (0, node_path_1.basename)(filePath);
    }
    return '';
}
function defaultIsRetry(response) {
    return response.status >= 500;
}
exports.channels = {
    request: node_diagnostics_channel_1.default.channel('urllib:request'),
    response: node_diagnostics_channel_1.default.channel('urllib:response'),
    fetchRequest: node_diagnostics_channel_1.default.channel('urllib:fetch:request'),
    fetchResponse: node_diagnostics_channel_1.default.channel('urllib:fetch:response'),
};
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
const RedirectStatusCodes = [
    301, // Moved Permanently
    302, // Found
    303, // See Other
    307, // Temporary Redirect
    308, // Permanent Redirect
];
class HttpClient extends node_events_1.EventEmitter {
    #defaultArgs;
    #dispatcher;
    constructor(clientOptions) {
        super();
        this.#defaultArgs = clientOptions?.defaultArgs;
        if (clientOptions?.lookup || clientOptions?.checkAddress) {
            this.#dispatcher = new HttpAgent_js_1.HttpAgent({
                lookup: clientOptions.lookup,
                checkAddress: clientOptions.checkAddress,
                connect: clientOptions.connect,
                allowH2: clientOptions.allowH2,
            });
        }
        else if (clientOptions?.connect) {
            this.#dispatcher = new undici_1.Agent({
                connect: clientOptions.connect,
                allowH2: clientOptions.allowH2,
            });
        }
        else if (clientOptions?.allowH2) {
            // Support HTTP2
            this.#dispatcher = new undici_1.Agent({
                allowH2: clientOptions.allowH2,
            });
        }
        (0, diagnosticsChannel_js_1.initDiagnosticsChannel)();
    }
    getDispatcher() {
        return this.#dispatcher ?? (0, undici_1.getGlobalDispatcher)();
    }
    setDispatcher(dispatcher) {
        this.#dispatcher = dispatcher;
    }
    getDispatcherPoolStats() {
        const agent = this.getDispatcher();
        // origin => Pool Instance
        const clients = Reflect.get(agent, symbols_js_1.default.kClients);
        const poolStatsMap = {};
        if (!clients) {
            return poolStatsMap;
        }
        for (const [key, ref] of clients) {
            const pool = (typeof ref.deref === 'function' ? ref.deref() : ref);
            // NOTE: pool become to { dispatcher: Pool } in undici@v7
            const stats = pool?.stats ?? pool?.dispatcher?.stats;
            if (!stats)
                continue;
            poolStatsMap[key] = {
                connected: stats.connected,
                free: stats.free,
                pending: stats.pending,
                queued: stats.queued,
                running: stats.running,
                size: stats.size,
            };
        }
        return poolStatsMap;
    }
    async request(url, options) {
        return await this.#requestInternal(url, options);
    }
    // alias to request, keep compatible with urllib@2 HttpClient.curl
    async curl(url, options) {
        return await this.request(url, options);
    }
    async #requestInternal(url, options, requestContext) {
        const requestId = (0, utils_js_1.globalId)('HttpClientRequest');
        let requestUrl;
        if (typeof url === 'string') {
            if (!exports.PROTO_RE.test(url)) {
                // Support `request('www.server.com')`
                url = 'http://' + url;
            }
            requestUrl = new URL(url);
        }
        else {
            if (!url.searchParams) {
                // url maybe url.parse(url) object in urllib2
                requestUrl = new URL((0, node_url_1.format)(url));
            }
            else {
                // or even if not, we clone to avoid mutating it
                requestUrl = new URL(url.toString());
            }
        }
        const method = (options?.type || options?.method || 'GET').toUpperCase();
        const originalHeaders = options?.headers;
        const headers = {};
        const args = {
            retry: 0,
            socketErrorRetry: 1,
            timing: true,
            ...this.#defaultArgs,
            ...options,
            // keep method and headers exists on args for request event handler to easy use
            method,
            headers,
        };
        requestContext = {
            retries: 0,
            socketErrorRetries: 0,
            redirects: 0,
            history: [],
            ...requestContext,
        };
        if (!requestContext.requestStartTime) {
            requestContext.requestStartTime = node_perf_hooks_1.performance.now();
        }
        requestContext.history.push(requestUrl.href);
        const requestStartTime = requestContext.requestStartTime;
        // https://developer.chrome.com/docs/devtools/network/reference/?utm_source=devtools#timing-explanation
        const timing = {
            // socket assigned
            queuing: 0,
            // dns lookup time
            dnslookup: 0,
            // socket connected
            connected: 0,
            // request headers sent
            requestHeadersSent: 0,
            // request sent, including headers and body
            requestSent: 0,
            // Time to first byte (TTFB), the response headers have been received
            waiting: 0,
            // the response body and trailers have been received
            contentDownload: 0,
        };
        const originalOpaque = args.opaque;
        // using opaque to diagnostics channel, binding request and socket
        const internalOpaque = {
            [symbols_js_2.default.kRequestId]: requestId,
            [symbols_js_2.default.kRequestStartTime]: requestStartTime,
            [symbols_js_2.default.kEnableRequestTiming]: !!args.timing,
            [symbols_js_2.default.kRequestTiming]: timing,
            [symbols_js_2.default.kRequestOriginalOpaque]: originalOpaque,
        };
        const reqMeta = {
            requestId,
            url: requestUrl.href,
            args,
            ctx: args.ctx,
            retries: requestContext.retries,
        };
        const socketInfo = {
            id: 0,
            localAddress: '',
            localPort: 0,
            remoteAddress: '',
            remotePort: 0,
            remoteFamily: '',
            bytesWritten: 0,
            bytesRead: 0,
            handledRequests: 0,
            handledResponses: 0,
        };
        // keep urllib createCallbackResponse style
        const resHeaders = {};
        let res = {
            status: -1,
            statusCode: -1,
            statusText: '',
            statusMessage: '',
            headers: resHeaders,
            size: 0,
            aborted: false,
            rt: 0,
            keepAliveSocket: true,
            requestUrls: requestContext.history,
            timing,
            socket: socketInfo,
            retries: requestContext.retries,
            socketErrorRetries: requestContext.socketErrorRetries,
        };
        let headersTimeout = 5000;
        let bodyTimeout = 5000;
        if (args.timeout) {
            if (Array.isArray(args.timeout)) {
                headersTimeout = args.timeout[0] ?? headersTimeout;
                bodyTimeout = args.timeout[1] ?? bodyTimeout;
            }
            else {
                // compatible with urllib@2 timeout string format
                headersTimeout = bodyTimeout = typeof args.timeout === 'string' ? parseInt(args.timeout) : args.timeout;
            }
        }
        if (originalHeaders) {
            // convert headers to lower-case
            for (const name in originalHeaders) {
                headers[name.toLowerCase()] = originalHeaders[name];
            }
        }
        // hidden user-agent
        const hiddenUserAgent = 'user-agent' in headers && !headers['user-agent'];
        if (hiddenUserAgent) {
            delete headers['user-agent'];
        }
        else if (!headers['user-agent']) {
            // need to set user-agent
            headers['user-agent'] = exports.HEADER_USER_AGENT;
        }
        // Alias to dataType = 'stream'
        if (args.streaming || args.customResponse) {
            args.dataType = 'stream';
        }
        if (args.dataType === 'json' && !headers.accept) {
            headers.accept = 'application/json';
        }
        // gzip alias to compressed
        if (args.gzip && args.compressed !== false) {
            args.compressed = true;
        }
        if (args.compressed && !headers['accept-encoding']) {
            headers['accept-encoding'] = 'gzip, br';
        }
        if (requestContext.retries > 0) {
            headers['x-urllib-retry'] = `${requestContext.retries}/${args.retry}`;
        }
        if (requestContext.socketErrorRetries > 0) {
            headers['x-urllib-retry-on-socket-error'] = `${requestContext.socketErrorRetries}/${args.socketErrorRetry}`;
        }
        if (args.auth && !headers.authorization) {
            headers.authorization = `Basic ${Buffer.from(args.auth).toString('base64')}`;
        }
        // streaming request should disable socketErrorRetry and retry
        let isStreamingRequest = false;
        let isStreamingResponse = false;
        if (args.dataType === 'stream' || args.writeStream) {
            isStreamingResponse = true;
        }
        let maxRedirects = args.maxRedirects ?? 10;
        try {
            const requestOptions = {
                method,
                // disable undici auto redirect handler
                // maxRedirections: 0,
                headersTimeout,
                headers,
                bodyTimeout,
                opaque: internalOpaque,
                dispatcher: args.dispatcher ?? this.#dispatcher,
                signal: args.signal,
                reset: false,
            };
            if (typeof args.highWaterMark === 'number') {
                requestOptions.highWaterMark = args.highWaterMark;
            }
            if (typeof args.reset === 'boolean') {
                requestOptions.reset = args.reset;
            }
            if (args.followRedirect === false) {
                maxRedirects = 0;
            }
            const isGETOrHEAD = requestOptions.method === 'GET' || requestOptions.method === 'HEAD';
            // alias to args.content
            if (args.stream && !args.content) {
                // convert old style stream to new stream
                // https://nodejs.org/dist/latest-v18.x/docs/api/stream.html#readablewrapstream
                if ((0, utils_js_1.isReadable)(args.stream) && !(args.stream instanceof node_stream_1.Readable)) {
                    debug('Request#%d convert old style stream to Readable', requestId);
                    args.stream = new node_stream_1.Readable().wrap(args.stream);
                    isStreamingRequest = true;
                }
                else if (args.stream instanceof formstream_1.default) {
                    debug('Request#%d convert formstream to Readable', requestId);
                    args.stream = new node_stream_1.Readable().wrap(args.stream);
                    isStreamingRequest = true;
                }
                args.content = args.stream;
            }
            if (args.files) {
                if (isGETOrHEAD) {
                    requestOptions.method = 'POST';
                }
                const formData = new FormData_js_1.FormData();
                const uploadFiles = [];
                if (Array.isArray(args.files)) {
                    for (const [index, file] of args.files.entries()) {
                        const field = index === 0 ? 'file' : `file${index}`;
                        uploadFiles.push([field, file]);
                    }
                }
                else if (args.files instanceof node_stream_1.Readable || (0, utils_js_1.isReadable)(args.files)) {
                    uploadFiles.push(['file', args.files]);
                }
                else if (typeof args.files === 'string' || Buffer.isBuffer(args.files)) {
                    uploadFiles.push(['file', args.files]);
                }
                else if (typeof args.files === 'object') {
                    const files = args.files;
                    for (const field in files) {
                        // set custom fileName
                        const file = files[field];
                        uploadFiles.push([field, file, field]);
                    }
                }
                // set normal fields first
                if (args.data) {
                    for (const field in args.data) {
                        formData.append(field, args.data[field]);
                    }
                }
                for (const [index, [field, file, customFileName]] of uploadFiles.entries()) {
                    let fileName = '';
                    let value;
                    if (typeof file === 'string') {
                        fileName = (0, node_path_1.basename)(file);
                        value = (0, node_fs_1.createReadStream)(file);
                    }
                    else if (Buffer.isBuffer(file)) {
                        fileName = customFileName || `bufferfile${index}`;
                        value = file;
                    }
                    else if (file instanceof node_stream_1.Readable || (0, utils_js_1.isReadable)(file)) {
                        fileName = getFileName(file) || customFileName || `streamfile${index}`;
                        isStreamingRequest = true;
                        value = file;
                    }
                    const mimeType = mime_types_1.default.lookup(fileName) || '';
                    formData.append(field, value, {
                        filename: fileName,
                        contentType: mimeType,
                    });
                    debug('formData append field: %s, mimeType: %s, fileName: %s', field, mimeType, fileName);
                }
                Object.assign(headers, formData.getHeaders());
                requestOptions.body = formData;
            }
            else if (args.content) {
                if (!isGETOrHEAD) {
                    // handle content
                    requestOptions.body = args.content;
                    if (args.contentType) {
                        headers['content-type'] = args.contentType;
                    }
                    else if (typeof args.content === 'string' && !headers['content-type']) {
                        headers['content-type'] = 'text/plain;charset=UTF-8';
                    }
                    isStreamingRequest = (0, utils_js_1.isReadable)(args.content);
                }
            }
            else if (args.data) {
                const isStringOrBufferOrReadable = typeof args.data === 'string' || Buffer.isBuffer(args.data) || (0, utils_js_1.isReadable)(args.data);
                if (isGETOrHEAD) {
                    if (!isStringOrBufferOrReadable) {
                        let query;
                        if (args.nestedQuerystring) {
                            query = qs_1.default.stringify(args.data);
                        }
                        else {
                            query = node_querystring_1.default.stringify(args.data);
                        }
                        // reset the requestUrl
                        const href = requestUrl.href;
                        requestUrl = new URL(href + (href.includes('?') ? '&' : '?') + query);
                    }
                }
                else {
                    if (isStringOrBufferOrReadable) {
                        requestOptions.body = args.data;
                        isStreamingRequest = (0, utils_js_1.isReadable)(args.data);
                    }
                    else {
                        if (args.contentType === 'json' ||
                            args.contentType === 'application/json' ||
                            headers['content-type']?.startsWith('application/json')) {
                            requestOptions.body = JSON.stringify(args.data);
                            if (!headers['content-type']) {
                                headers['content-type'] = 'application/json';
                            }
                        }
                        else {
                            headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
                            if (args.nestedQuerystring) {
                                requestOptions.body = qs_1.default.stringify(args.data);
                            }
                            else {
                                requestOptions.body = new URLSearchParams(args.data).toString();
                            }
                        }
                    }
                }
            }
            if (isStreamingRequest) {
                args.retry = 0;
                args.socketErrorRetry = 0;
                maxRedirects = 0;
            }
            if (isStreamingResponse) {
                args.retry = 0;
                args.socketErrorRetry = 0;
            }
            debug('Request#%d %s %s, headers: %j, headersTimeout: %s, bodyTimeout: %s, isStreamingRequest: %s, isStreamingResponse: %s, maxRedirections: %s, redirects: %s', requestId, requestOptions.method, requestUrl.href, headers, headersTimeout, bodyTimeout, isStreamingRequest, isStreamingResponse, maxRedirects, requestContext.redirects);
            requestOptions.headers = headers;
            exports.channels.request.publish({
                request: reqMeta,
            });
            if (this.listenerCount('request') > 0) {
                this.emit('request', reqMeta);
            }
            let response = await (0, undici_1.request)(requestUrl, requestOptions);
            if (response.statusCode === 401 &&
                (response.headers['www-authenticate'] || response.headers['x-www-authenticate']) &&
                !requestOptions.headers.authorization &&
                args.digestAuth) {
                // handle digest auth
                const authenticateHeaders = response.headers['www-authenticate'] ?? response.headers['x-www-authenticate'];
                const authenticate = Array.isArray(authenticateHeaders)
                    ? authenticateHeaders.find((authHeader) => authHeader.startsWith('Digest '))
                    : authenticateHeaders;
                if (authenticate && authenticate.startsWith('Digest ')) {
                    debug('Request#%d %s: got digest auth header WWW-Authenticate: %s', requestId, requestUrl.href, authenticate);
                    requestOptions.headers.authorization = (0, utils_js_1.digestAuthHeader)(requestOptions.method, `${requestUrl.pathname}${requestUrl.search}`, authenticate, args.digestAuth);
                    debug('Request#%d %s: auth with digest header: %s', requestId, url, requestOptions.headers.authorization);
                    if (Array.isArray(response.headers['set-cookie'])) {
                        // FIXME: merge exists cookie header
                        requestOptions.headers.cookie = response.headers['set-cookie'].join(';');
                    }
                    // Ensure the previous response is consumed as we re-use the same variable
                    await response.body.arrayBuffer();
                    response = await (0, undici_1.request)(requestUrl, requestOptions);
                }
            }
            const contentEncoding = response.headers['content-encoding'];
            const isCompressedContent = contentEncoding === 'gzip' || contentEncoding === 'br';
            res.headers = response.headers;
            res.status = res.statusCode = response.statusCode;
            res.statusMessage = res.statusText = node_http_1.STATUS_CODES[res.status] || '';
            if (res.headers['content-length']) {
                res.size = parseInt(res.headers['content-length']);
            }
            // https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
            if (RedirectStatusCodes.includes(res.statusCode) && maxRedirects > 0 && requestContext.redirects < maxRedirects) {
                if (res.headers.location) {
                    requestContext.redirects++;
                    const nextUrl = new URL(res.headers.location, requestUrl.href);
                    // Ensure the response is consumed
                    await response.body.arrayBuffer();
                    debug('Request#%d got response, status: %s, headers: %j, timing: %j, redirect to %s', requestId, res.status, res.headers, res.timing, nextUrl.href);
                    return await this.#requestInternal(nextUrl.href, options, requestContext);
                }
            }
            let data = null;
            if (args.dataType === 'stream') {
                // only auto decompress on request args.compressed = true
                if (args.compressed === true && isCompressedContent) {
                    // gzip or br
                    const decoder = contentEncoding === 'gzip' ? (0, node_zlib_1.createGunzip)() : (0, node_zlib_1.createBrotliDecompress)();
                    res = Object.assign((0, node_stream_1.pipeline)(response.body, decoder, noop), res);
                }
                else {
                    res = Object.assign(response.body, res);
                }
            }
            else if (args.writeStream) {
                if (args.compressed === true && isCompressedContent) {
                    const decoder = contentEncoding === 'gzip' ? (0, node_zlib_1.createGunzip)() : (0, node_zlib_1.createBrotliDecompress)();
                    await (0, promises_1.pipeline)(response.body, decoder, args.writeStream);
                }
                else {
                    await (0, promises_1.pipeline)(response.body, args.writeStream);
                }
            }
            else {
                // buffer
                data = Buffer.from(await response.body.arrayBuffer());
                if (isCompressedContent && data.length > 0) {
                    try {
                        data = contentEncoding === 'gzip' ? (0, node_zlib_1.gunzipSync)(data) : (0, node_zlib_1.brotliDecompressSync)(data);
                    }
                    catch (err) {
                        if (err.name === 'Error') {
                            err.name = 'UnzipError';
                        }
                        throw err;
                    }
                }
                if (args.dataType === 'text' || args.dataType === 'html') {
                    data = data.toString();
                }
                else if (args.dataType === 'json') {
                    if (data.length === 0) {
                        data = null;
                    }
                    else {
                        data = (0, utils_js_1.parseJSON)(data.toString(), args.fixJSONCtlChars);
                    }
                }
            }
            res.rt = (0, utils_js_1.performanceTime)(requestStartTime);
            // get real socket info from internalOpaque
            (0, utils_js_1.updateSocketInfo)(socketInfo, internalOpaque);
            const clientResponse = {
                opaque: originalOpaque,
                data,
                status: res.status,
                statusCode: res.status,
                statusText: res.statusText,
                headers: res.headers,
                url: requestUrl.href,
                redirected: requestContext.history.length > 1,
                requestUrls: res.requestUrls,
                res,
            };
            debug('Request#%d got response, status: %s, headers: %j, timing: %j, socket: %j', requestId, res.status, res.headers, res.timing, res.socket);
            if (args.retry > 0 && requestContext.retries < args.retry) {
                const isRetry = args.isRetry ?? defaultIsRetry;
                if (isRetry(clientResponse)) {
                    if (args.retryDelay) {
                        await (0, promises_2.setTimeout)(args.retryDelay);
                    }
                    requestContext.retries++;
                    return await this.#requestInternal(url, options, requestContext);
                }
            }
            exports.channels.response.publish({
                request: reqMeta,
                response: res,
            });
            if (this.listenerCount('response') > 0) {
                this.emit('response', {
                    requestId,
                    error: null,
                    ctx: args.ctx,
                    req: {
                        ...reqMeta,
                        options: args,
                    },
                    res,
                });
            }
            return clientResponse;
        }
        catch (rawError) {
            debug('Request#%d throw error: %s, socketErrorRetry: %s, socketErrorRetries: %s', requestId, rawError, args.socketErrorRetry, requestContext.socketErrorRetries);
            let err = rawError;
            if (err.name === 'HeadersTimeoutError') {
                err = new HttpClientError_js_1.HttpClientRequestTimeoutError(headersTimeout, { cause: err });
            }
            else if (err.name === 'BodyTimeoutError') {
                err = new HttpClientError_js_1.HttpClientRequestTimeoutError(bodyTimeout, { cause: err });
            }
            else if (err.name === 'InformationalError' && err.message.includes('stream timeout')) {
                err = new HttpClientError_js_1.HttpClientRequestTimeoutError(bodyTimeout, { cause: err });
            }
            else if (err.code === 'UND_ERR_CONNECT_TIMEOUT') {
                err = new HttpClientError_js_1.HttpClientConnectTimeoutError(err.message, err.code, { cause: err });
            }
            else if (err.code === 'UND_ERR_SOCKET' || err.code === 'ECONNRESET') {
                // auto retry on socket error, https://github.com/node-modules/urllib/issues/454
                if (args.socketErrorRetry > 0 && requestContext.socketErrorRetries < args.socketErrorRetry) {
                    requestContext.socketErrorRetries++;
                    debug('Request#%d retry on socket error, socketErrorRetries: %d', requestId, requestContext.socketErrorRetries);
                    return await this.#requestInternal(url, options, requestContext);
                }
            }
            err.opaque = originalOpaque;
            err.status = res.status;
            err.headers = res.headers;
            err.res = res;
            if (err.socket) {
                // store rawSocket
                err._rawSocket = err.socket;
            }
            err.socket = socketInfo;
            res.rt = (0, utils_js_1.performanceTime)(requestStartTime);
            (0, utils_js_1.updateSocketInfo)(socketInfo, internalOpaque, rawError);
            exports.channels.response.publish({
                request: reqMeta,
                response: res,
                error: err,
            });
            if (this.listenerCount('response') > 0) {
                this.emit('response', {
                    requestId,
                    error: err,
                    ctx: args.ctx,
                    req: {
                        ...reqMeta,
                        options: args,
                    },
                    res,
                });
            }
            throw err;
        }
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSHR0cENsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9IdHRwQ2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHdGQUEwRDtBQUUxRCw2Q0FBMkM7QUFDM0MscUNBQTJDO0FBQzNDLHlDQUF5QztBQUV6Qyx5Q0FBcUM7QUFDckMscURBQThDO0FBQzlDLHdFQUEyQztBQUMzQyw2Q0FBaUQ7QUFDakQsbURBQW1FO0FBQ25FLG1EQUEyRDtBQUMzRCx1Q0FBK0M7QUFDL0MseUNBQXFDO0FBQ3JDLHlDQUFtRztBQUVuRyx1Q0FBdUM7QUFDdkMsNERBQW9DO0FBQ3BDLDREQUE4QjtBQUM5Qiw0Q0FBb0I7QUFDcEIsbUNBQWdHO0FBQ2hHLDZEQUE2RDtBQUM3RCxhQUFhO0FBQ2IsNEVBQXVEO0FBRXZELG1FQUFpRTtBQUVqRSwrQ0FBeUM7QUFDekMsaURBQTJDO0FBRTNDLDZEQUFvRztBQUlwRyw4REFBbUM7QUFDbkMseUNBQWtIO0FBT3JHLFFBQUEsUUFBUSxHQUFXLGVBQWUsQ0FBQztBQTBCaEQsU0FBUyxJQUFJO0lBQ1gsT0FBTztBQUNULENBQUM7QUFFRCxNQUFNLEtBQUssR0FBRyxJQUFBLG9CQUFRLEVBQUMsbUJBQW1CLENBQUMsQ0FBQztBQXdDL0IsUUFBQSxPQUFPLEdBQVcsU0FBUyxDQUFDO0FBQ3pDLG9EQUFvRDtBQUN2QyxRQUFBLGlCQUFpQixHQUFXLGVBQWUsZUFBTyxZQUFZLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDO0FBRWpKLFNBQVMsV0FBVyxDQUFDLE1BQWdCO0lBQ25DLE1BQU0sUUFBUSxHQUFZLE1BQWMsQ0FBQyxJQUFJLENBQUM7SUFDOUMsSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUNiLE9BQU8sSUFBQSxvQkFBUSxFQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzVC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
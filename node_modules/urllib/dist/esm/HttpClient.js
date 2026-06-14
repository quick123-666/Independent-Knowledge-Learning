import diagnosticsChannel from 'node:diagnostics_channel';
import { EventEmitter } from 'node:events';
import { createReadStream } from 'node:fs';
import { STATUS_CODES } from 'node:http';
import { basename } from 'node:path';
import { performance } from 'node:perf_hooks';
import querystring from 'node:querystring';
import { Readable, pipeline } from 'node:stream';
import { pipeline as pipelinePromise } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { format as urlFormat } from 'node:url';
import { debuglog } from 'node:util';
import { createGunzip, createBrotliDecompress, gunzipSync, brotliDecompressSync } from 'node:zlib';
// Compatible with old style formstream
import FormStream from 'formstream';
import mime from 'mime-types';
import qs from 'qs';
import { request as undiciRequest, Agent, getGlobalDispatcher } from 'undici';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import undiciSymbols from 'undici/lib/core/symbols.js';
import { initDiagnosticsChannel } from './diagnosticsChannel.js';
import { FormData } from './FormData.js';
import { HttpAgent } from './HttpAgent.js';
import { HttpClientConnectTimeoutError, HttpClientRequestTimeoutError } from './HttpClientError.js';
import symbols from './symbols.js';
import { parseJSON, digestAuthHeader, globalId, performanceTime, isReadable, updateSocketInfo } from './utils.js';
export const PROTO_RE = /^https?:\/\//i;
function noop() {
    // noop
}
const debug = debuglog('urllib:HttpClient');
export const VERSION = '4.9.0';
// 'node-urllib/4.0.0 Node.js/18.19.0 (darwin; x64)'
export const HEADER_USER_AGENT = `node-urllib/${VERSION} Node.js/${process.version.substring(1)} (${process.platform}; ${process.arch})`;
function getFileName(stream) {
    const filePath = stream.path;
    if (filePath) {
        return basename(filePath);
    }
    return '';
}
function defaultIsRetry(response) {
    return response.status >= 500;
}
export const channels = {
    request: diagnosticsChannel.channel('urllib:request'),
    response: diagnosticsChannel.channel('urllib:response'),
    fetchRequest: diagnosticsChannel.channel('urllib:fetch:request'),
    fetchResponse: diagnosticsChannel.channel('urllib:fetch:response'),
};
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
const RedirectStatusCodes = [
    301, // Moved Permanently
    302, // Found
    303, // See Other
    307, // Temporary Redirect
    308, // Permanent Redirect
];
export class HttpClient extends EventEmitter {
    #defaultArgs;
    #dispatcher;
    constructor(clientOptions) {
        super();
        this.#defaultArgs = clientOptions?.defaultArgs;
        if (clientOptions?.lookup || clientOptions?.checkAddress) {
            this.#dispatcher = new HttpAgent({
                lookup: clientOptions.lookup,
                checkAddress: clientOptions.checkAddress,
                connect: clientOptions.connect,
                allowH2: clientOptions.allowH2,
            });
        }
        else if (clientOptions?.connect) {
            this.#dispatcher = new Agent({
                connect: clientOptions.connect,
                allowH2: clientOptions.allowH2,
            });
        }
        else if (clientOptions?.allowH2) {
            // Support HTTP2
            this.#dispatcher = new Agent({
                allowH2: clientOptions.allowH2,
            });
        }
        initDiagnosticsChannel();
    }
    getDispatcher() {
        return this.#dispatcher ?? getGlobalDispatcher();
    }
    setDispatcher(dispatcher) {
        this.#dispatcher = dispatcher;
    }
    getDispatcherPoolStats() {
        const agent = this.getDispatcher();
        // origin => Pool Instance
        const clients = Reflect.get(agent, undiciSymbols.kClients);
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
        const requestId = globalId('HttpClientRequest');
        let requestUrl;
        if (typeof url === 'string') {
            if (!PROTO_RE.test(url)) {
                // Support `request('www.server.com')`
                url = 'http://' + url;
            }
            requestUrl = new URL(url);
        }
        else {
            if (!url.searchParams) {
                // url maybe url.parse(url) object in urllib2
                requestUrl = new URL(urlFormat(url));
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
            requestContext.requestStartTime = performance.now();
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
            [symbols.kRequestId]: requestId,
            [symbols.kRequestStartTime]: requestStartTime,
            [symbols.kEnableRequestTiming]: !!args.timing,
            [symbols.kRequestTiming]: timing,
            [symbols.kRequestOriginalOpaque]: originalOpaque,
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
            headers['user-agent'] = HEADER_USER_AGENT;
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
                if (isReadable(args.stream) && !(args.stream instanceof Readable)) {
                    debug('Request#%d convert old style stream to Readable', requestId);
                    args.stream = new Readable().wrap(args.stream);
                    isStreamingRequest = true;
                }
                else if (args.stream instanceof FormStream) {
                    debug('Request#%d convert formstream to Readable', requestId);
                    args.stream = new Readable().wrap(args.stream);
                    isStreamingRequest = true;
                }
                args.content = args.stream;
            }
            if (args.files) {
                if (isGETOrHEAD) {
                    requestOptions.method = 'POST';
                }
                const formData = new FormData();
                const uploadFiles = [];
                if (Array.isArray(args.files)) {
                    for (const [index, file] of args.files.entries()) {
                        const field = index === 0 ? 'file' : `file${index}`;
                        uploadFiles.push([field, file]);
                    }
                }
                else if (args.files instanceof Readable || isReadable(args.files)) {
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
                        fileName = basename(file);
                        value = createReadStream(file);
                    }
                    else if (Buffer.isBuffer(file)) {
                        fileName = customFileName || `bufferfile${index}`;
                        value = file;
                    }
                    else if (file instanceof Readable || isReadable(file)) {
                        fileName = getFileName(file) || customFileName || `streamfile${index}`;
                        isStreamingRequest = true;
                        value = file;
                    }
                    const mimeType = mime.lookup(fileName) || '';
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
                    isStreamingRequest = isReadable(args.content);
                }
            }
            else if (args.data) {
                const isStringOrBufferOrReadable = typeof args.data === 'string' || Buffer.isBuffer(args.data) || isReadable(args.data);
                if (isGETOrHEAD) {
                    if (!isStringOrBufferOrReadable) {
                        let query;
                        if (args.nestedQuerystring) {
                            query = qs.stringify(args.data);
                        }
                        else {
                            query = querystring.stringify(args.data);
                        }
                        // reset the requestUrl
                        const href = requestUrl.href;
                        requestUrl = new URL(href + (href.includes('?') ? '&' : '?') + query);
                    }
                }
                else {
                    if (isStringOrBufferOrReadable) {
                        requestOptions.body = args.data;
                        isStreamingRequest = isReadable(args.data);
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
                                requestOptions.body = qs.stringify(args.data);
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
            channels.request.publish({
                request: reqMeta,
            });
            if (this.listenerCount('request') > 0) {
                this.emit('request', reqMeta);
            }
            let response = await undiciRequest(requestUrl, requestOptions);
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
                    requestOptions.headers.authorization = digestAuthHeader(requestOptions.method, `${requestUrl.pathname}${requestUrl.search}`, authenticate, args.digestAuth);
                    debug('Request#%d %s: auth with digest header: %s', requestId, url, requestOptions.headers.authorization);
                    if (Array.isArray(response.headers['set-cookie'])) {
                        // FIXME: merge exists cookie header
                        requestOptions.headers.cookie = response.headers['set-cookie'].join(';');
                    }
                    // Ensure the previous response is consumed as we re-use the same variable
                    await response.body.arrayBuffer();
                    response = await undiciRequest(requestUrl, requestOptions);
                }
            }
            const contentEncoding = response.headers['content-encoding'];
            const isCompressedContent = contentEncoding === 'gzip' || contentEncoding === 'br';
            res.headers = response.headers;
            res.status = res.statusCode = response.statusCode;
            res.statusMessage = res.statusText = STATUS_CODES[res.status] || '';
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
                    const decoder = contentEncoding === 'gzip' ? createGunzip() : createBrotliDecompress();
                    res = Object.assign(pipeline(response.body, decoder, noop), res);
                }
                else {
                    res = Object.assign(response.body, res);
                }
            }
            else if (args.writeStream) {
                if (args.compressed === true && isCompressedContent) {
                    const decoder = contentEncoding === 'gzip' ? createGunzip() : createBrotliDecompress();
                    await pipelinePromise(response.body, decoder, args.writeStream);
                }
                else {
                    await pipelinePromise(response.body, args.writeStream);
                }
            }
            else {
                // buffer
                data = Buffer.from(await response.body.arrayBuffer());
                if (isCompressedContent && data.length > 0) {
                    try {
                        data = contentEncoding === 'gzip' ? gunzipSync(data) : brotliDecompressSync(data);
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
                        data = parseJSON(data.toString(), args.fixJSONCtlChars);
                    }
                }
            }
            res.rt = performanceTime(requestStartTime);
            // get real socket info from internalOpaque
            updateSocketInfo(socketInfo, internalOpaque);
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
                        await sleep(args.retryDelay);
                    }
                    requestContext.retries++;
                    return await this.#requestInternal(url, options, requestContext);
                }
            }
            channels.response.publish({
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
                err = new HttpClientRequestTimeoutError(headersTimeout, { cause: err });
            }
            else if (err.name === 'BodyTimeoutError') {
                err = new HttpClientRequestTimeoutError(bodyTimeout, { cause: err });
            }
            else if (err.name === 'InformationalError' && err.message.includes('stream timeout')) {
                err = new HttpClientRequestTimeoutError(bodyTimeout, { cause: err });
            }
            else if (err.code === 'UND_ERR_CONNECT_TIMEOUT') {
                err = new HttpClientConnectTimeoutError(err.message, err.code, { cause: err });
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
            res.rt = performanceTime(requestStartTime);
            updateSocketInfo(socketInfo, internalOpaque, rawError);
            channels.response.publish({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSHR0cENsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9IdHRwQ2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sa0JBQWtCLE1BQU0sMEJBQTBCLENBQUM7QUFFMUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUMzQyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFDM0MsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUV6QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUM5QyxPQUFPLFdBQVcsTUFBTSxrQkFBa0IsQ0FBQztBQUMzQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUNqRCxPQUFPLEVBQUUsUUFBUSxJQUFJLGVBQWUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLElBQUksS0FBSyxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDM0QsT0FBTyxFQUFFLE1BQU0sSUFBSSxTQUFTLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDL0MsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNyQyxPQUFPLEVBQUUsWUFBWSxFQUFFLHNCQUFzQixFQUFFLFVBQVUsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUVuRyx1Q0FBdUM7QUFDdkMsT0FBTyxVQUFVLE1BQU0sWUFBWSxDQUFDO0FBQ3BDLE9BQU8sSUFBSSxNQUFNLFlBQVksQ0FBQztBQUM5QixPQUFPLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDcEIsT0FBTyxFQUFFLE9BQU8sSUFBSSxhQUFhLEVBQWMsS0FBSyxFQUFFLG1CQUFtQixFQUFRLE1BQU0sUUFBUSxDQUFDO0FBQ2hHLDZE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
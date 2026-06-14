"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = exports.FetchFactory = void 0;
const node_async_hooks_1 = require("node:async_hooks");
const node_util_1 = require("node:util");
const undici_1 = require("undici");
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const symbols_js_1 = __importDefault(require("undici/lib/core/symbols.js"));
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const response_js_1 = require("undici/lib/web/fetch/response.js");
const BaseAgent_js_1 = require("./BaseAgent.js");
const diagnosticsChannel_js_1 = require("./diagnosticsChannel.js");
const HttpAgent_js_1 = require("./HttpAgent.js");
const HttpClient_js_1 = require("./HttpClient.js");
const symbols_js_2 = __importDefault(require("./symbols.js"));
const utils_js_1 = require("./utils.js");
const debug = (0, node_util_1.debuglog)('urllib/fetch');
class FetchFactory {
    #dispatcher;
    #opaqueLocalStorage = new node_async_hooks_1.AsyncLocalStorage();
    static #instance = new FetchFactory();
    setClientOptions(clientOptions) {
        let dispatcherOption = {
            opaqueLocalStorage: this.#opaqueLocalStorage,
        };
        let dispatcherClazz = BaseAgent_js_1.BaseAgent;
        if (clientOptions?.lookup || clientOptions?.checkAddress) {
            dispatcherOption = {
                ...dispatcherOption,
                lookup: clientOptions.lookup,
                checkAddress: clientOptions.checkAddress,
                connect: clientOptions.connect,
                allowH2: clientOptions.allowH2,
            };
            dispatcherClazz = HttpAgent_js_1.HttpAgent;
        }
        else if (clientOptions?.connect) {
            dispatcherOption = {
                ...dispatcherOption,
                connect: clientOptions.connect,
                allowH2: clientOptions.allowH2,
            };
            dispatcherClazz = BaseAgent_js_1.BaseAgent;
        }
        else if (clientOptions?.allowH2) {
            // Support HTTP2
            dispatcherOption = {
                ...dispatcherOption,
                allowH2: clientOptions.allowH2,
            };
            dispatcherClazz = BaseAgent_js_1.BaseAgent;
        }
        this.#dispatcher = new dispatcherClazz(dispatcherOption);
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
    static setClientOptions(clientOptions) {
        FetchFactory.#instance.setClientOptions(clientOptions);
    }
    static getDispatcherPoolStats() {
        return FetchFactory.#instance.getDispatcherPoolStats();
    }
    async fetch(input, init) {
        const requestStartTime = performance.now();
        init = init ?? {};
        init.dispatcher = init.dispatcher ?? this.#dispatcher;
        const request = new undici_1.Request(input, init);
        const requestId = (0, utils_js_1.globalId)('HttpClientRequest');
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
        // using opaque to diagnostics channel, binding request and socket
        const internalOpaque = {
            [symbols_js_2.default.kRequestId]: requestId,
            [symbols_js_2.default.kRequestStartTime]: requestStartTime,
            [symbols_js_2.default.kEnableRequestTiming]: !!(init.timing ?? true),
            [symbols_js_2.default.kRequestTiming]: timing,
            // [symbols.kRequestOriginalOpaque]: originalOpaque,
        };
        const reqMeta = {
            requestId,
            url: request.url,
            args: {
                method: request.method,
                type: request.method,
                data: request.body,
                headers: (0, utils_js_1.convertHeader)(request.headers),
            },
            retries: 0,
        };
        const fetchMeta = {
            requestId,
            request,
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
        HttpClient_js_1.channels.request.publish({
            request: reqMeta,
            isSentByFetch: true,
            fetchOpaque: internalOpaque,
        });
        HttpClient_js_1.channels.fetchRequest.publish({
            fetch: fetchMeta,
            fetchOpaque: internalOpaque,
        });
        let res;
        // keep urllib createCallbackResponse style
        const resHeaders = {};
        const urllibResponse = {
            status: -1,
            statusCode: -1,
            statusText: '',
            statusMessage: '',
            headers: resHeaders,
            size: 0,
            aborted: false,
            rt: 0,
            keepAliveSocket: true,
            requestUrls: [request.url],
            timing,
            socket: socketInfo,
            retries: 0,
            socketErrorRetries: 0,
        };
        try {
            await this.#opaqueLocalStorage.run(internalOpaque, async () => {
                res = await (0, undici_1.fetch)(request);
            });
        }
        catch (e) {
            (0, utils_js_1.updateSocketInfo)(socketInfo, internalOpaque, e);
            urllibResponse.rt = (0, utils_js_1.performanceTime)(requestStartTime);
            debug('Request#%d throw error: %s', requestId, e);
            HttpClient_js_1.channels.fetchResponse.publish({
                fetch: fetchMeta,
                error: e,
                fetchOpaque: internalOpaque,
            });
            HttpClient_js_1.channels.response.publish({
                request: reqMeta,
                response: urllibResponse,
                error: e,
                isSentByFetch: true,
                fetchOpaque: internalOpaque,
            });
            throw e;
        }
        // get undici internal response
        const state = (0, response_js_1.getResponseState)(res);
        (0, utils_js_1.updateSocketInfo)(socketInfo, internalOpaque);
        urllibResponse.headers = (0, utils_js_1.convertHeader)(res.headers);
        urllibResponse.status = urllibResponse.statusCode = res.status;
        urllibResponse.statusMessage = res.statusText;
        if (urllibResponse.headers['content-length']) {
            urllibResponse.size = parseInt(urllibResponse.headers['content-length']);
        }
        urllibResponse.rt = (0, utils_js_1.performanceTime)(requestStartTime);
        debug('Request#%d got response, status: %s, headers: %j, timing: %j, socket: %j', requestId, urllibResponse.status, urllibResponse.headers, timing, urllibResponse.socket);
        HttpClient_js_1.channels.fetchResponse.publish({
            fetch: fetchMeta,
            timingInfo: state.timingInfo,
            response: res,
            fetchOpaque: internalOpaque,
        });
        HttpClient_js_1.channels.response.publish({
            request: reqMeta,
            response: urllibResponse,
            isSentByFetch: true,
            fetchOpaque: internalOpaque,
        });
        return res;
    }
    static getDispatcher() {
        return FetchFactory.#instance.getDispatcher();
    }
    static setDispatcher(dispatcher) {
        FetchFactory.#instance.setDispatcher(dispatcher);
    }
    static async fetch(input, init) {
        return FetchFactory.#instance.fetch(input, init);
    }
}
exports.FetchFactory = FetchFactory;
exports.fetch = FetchFactory.fetch;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmV0Y2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvZmV0Y2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsdURBQXFEO0FBQ3JELHlDQUFxQztBQUVyQyxtQ0FBK0c7QUFFL0csNkRBQTZEO0FBQzdELGFBQWE7QUFDYiw0RUFBdUQ7QUFDdkQsNkRBQTZEO0FBQzdELGFBQWE7QUFDYixrRUFBb0U7QUFFcEUsaURBQTJDO0FBRTNDLG1FQUFpRTtBQUVqRSxpREFBMkM7QUFFM0MsbURBQTJDO0FBVzNDLDhEQUFtQztBQUNuQyx5Q0FBd0Y7QUFFeEYsTUFBTSxLQUFLLEdBQUcsSUFBQSxvQkFBUSxFQUFDLGNBQWMsQ0FBQyxDQUFDO0FBb0J2QyxNQUFhLFlBQVk7SUFDdkIsV0FBVyxDQUFpQztJQUM1QyxtQkFBbUIsR0FBRyxJQUFJLG9DQUFpQixFQUFlLENBQUM7SUFFM0QsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDO0lBRXRDLGdCQUFnQixDQUFDLGFBQTRCO1FBQzNDLElBQUksZ0JBQWdCLEdBQXFCO1lBQ3ZDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxtQkFBbUI7U0FDN0MsQ0FBQztRQUNGLElBQUksZUFBZSxHQUFpRCx3QkFBUyxDQUFDO1FBQzlFLElBQUksYUFBYSxFQUFFLE1BQU0sSUFBSSxhQUFhLEVBQUUsWUFBWSxFQUFFLENBQUM7WUFDekQsZ0JBQWdCLEdBQUc7Z0JBQ2pCLEdBQUcsZ0JBQWdCO2dCQUNuQixNQUFNLEVBQUUsYUFBYSxDQUFDLE1BQU07Z0JBQzVCLFlBQVksRUFBRSxhQUFhLENBQUMsWUFBWTtnQkFDeEMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxPQUFPO2dCQUM5QixPQUFPLEVBQUUsYUFBYSxDQUFDLE9BQU87YUFDWCxDQUFDO1lBQ3RCLGVBQWUsR0FBRyx3QkFBb0UsQ0FBQztRQUN6RixDQUFDO2FBQU0sSUFBSSxhQUFhLEVBQUUsT0FBTyxFQUFFLENBQUM7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
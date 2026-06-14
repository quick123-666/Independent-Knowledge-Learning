import { AsyncLocalStorage } from 'node:async_hooks';
import { debuglog } from 'node:util';
import { fetch as UndiciFetch, Request, getGlobalDispatcher } from 'undici';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import undiciSymbols from 'undici/lib/core/symbols.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { getResponseState } from 'undici/lib/web/fetch/response.js';
import { BaseAgent } from './BaseAgent.js';
import { initDiagnosticsChannel } from './diagnosticsChannel.js';
import { HttpAgent } from './HttpAgent.js';
import { channels } from './HttpClient.js';
import symbols from './symbols.js';
import { convertHeader, globalId, performanceTime, updateSocketInfo } from './utils.js';
const debug = debuglog('urllib/fetch');
export class FetchFactory {
    #dispatcher;
    #opaqueLocalStorage = new AsyncLocalStorage();
    static #instance = new FetchFactory();
    setClientOptions(clientOptions) {
        let dispatcherOption = {
            opaqueLocalStorage: this.#opaqueLocalStorage,
        };
        let dispatcherClazz = BaseAgent;
        if (clientOptions?.lookup || clientOptions?.checkAddress) {
            dispatcherOption = {
                ...dispatcherOption,
                lookup: clientOptions.lookup,
                checkAddress: clientOptions.checkAddress,
                connect: clientOptions.connect,
                allowH2: clientOptions.allowH2,
            };
            dispatcherClazz = HttpAgent;
        }
        else if (clientOptions?.connect) {
            dispatcherOption = {
                ...dispatcherOption,
                connect: clientOptions.connect,
                allowH2: clientOptions.allowH2,
            };
            dispatcherClazz = BaseAgent;
        }
        else if (clientOptions?.allowH2) {
            // Support HTTP2
            dispatcherOption = {
                ...dispatcherOption,
                allowH2: clientOptions.allowH2,
            };
            dispatcherClazz = BaseAgent;
        }
        this.#dispatcher = new dispatcherClazz(dispatcherOption);
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
        const request = new Request(input, init);
        const requestId = globalId('HttpClientRequest');
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
            [symbols.kRequestId]: requestId,
            [symbols.kRequestStartTime]: requestStartTime,
            [symbols.kEnableRequestTiming]: !!(init.timing ?? true),
            [symbols.kRequestTiming]: timing,
            // [symbols.kRequestOriginalOpaque]: originalOpaque,
        };
        const reqMeta = {
            requestId,
            url: request.url,
            args: {
                method: request.method,
                type: request.method,
                data: request.body,
                headers: convertHeader(request.headers),
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
        channels.request.publish({
            request: reqMeta,
            isSentByFetch: true,
            fetchOpaque: internalOpaque,
        });
        channels.fetchRequest.publish({
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
                res = await UndiciFetch(request);
            });
        }
        catch (e) {
            updateSocketInfo(socketInfo, internalOpaque, e);
            urllibResponse.rt = performanceTime(requestStartTime);
            debug('Request#%d throw error: %s', requestId, e);
            channels.fetchResponse.publish({
                fetch: fetchMeta,
                error: e,
                fetchOpaque: internalOpaque,
            });
            channels.response.publish({
                request: reqMeta,
                response: urllibResponse,
                error: e,
                isSentByFetch: true,
                fetchOpaque: internalOpaque,
            });
            throw e;
        }
        // get undici internal response
        const state = getResponseState(res);
        updateSocketInfo(socketInfo, internalOpaque);
        urllibResponse.headers = convertHeader(res.headers);
        urllibResponse.status = urllibResponse.statusCode = res.status;
        urllibResponse.statusMessage = res.statusText;
        if (urllibResponse.headers['content-length']) {
            urllibResponse.size = parseInt(urllibResponse.headers['content-length']);
        }
        urllibResponse.rt = performanceTime(requestStartTime);
        debug('Request#%d got response, status: %s, headers: %j, timing: %j, socket: %j', requestId, urllibResponse.status, urllibResponse.headers, timing, urllibResponse.socket);
        channels.fetchResponse.publish({
            fetch: fetchMeta,
            timingInfo: state.timingInfo,
            response: res,
            fetchOpaque: internalOpaque,
        });
        channels.response.publish({
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
export const fetch = FetchFactory.fetch;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmV0Y2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvZmV0Y2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDckQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUVyQyxPQUFPLEVBQUUsS0FBSyxJQUFJLFdBQVcsRUFBRSxPQUFPLEVBQW1CLG1CQUFtQixFQUFvQixNQUFNLFFBQVEsQ0FBQztBQUUvRyw2REFBNkQ7QUFDN0QsYUFBYTtBQUNiLE9BQU8sYUFBYSxNQUFNLDRCQUE0QixDQUFDO0FBQ3ZELDZEQUE2RDtBQUM3RCxhQUFhO0FBQ2IsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFcEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRTNDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBRWpFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUUzQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFXM0MsT0FBTyxPQUFPLE1BQU0sY0FBYyxDQUFDO0FBQ25DLE9BQU8sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUV4RixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUM7QUFvQnZDLE1BQU0sT0FBTyxZQUFZO0lBQ3ZCLFdBQVcsQ0FBaUM7SUFDNUMsbUJBQW1CLEdBQUcsSUFBSSxpQkFBaUIsRUFBZSxDQUFDO0lBRTNELE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztJQUV0QyxnQkFBZ0IsQ0FBQyxhQUE0QjtRQUMzQyxJQUFJLGdCQUFnQixHQUFxQjtZQUN2QyxrQkFBa0IsRUFB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
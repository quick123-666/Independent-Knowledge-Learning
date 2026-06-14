import diagnosticsChannel from 'node:diagnostics_channel';
import { Socket } from 'node:net';
import { performance } from 'node:perf_hooks';
import { debuglog } from 'node:util';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import symbols from './symbols.js';
import { globalId, performanceTime } from './utils.js';
const debug = debuglog('urllib/diagnosticsChannel');
let initedDiagnosticsChannel = false;
// https://undici.nodejs.org/#/docs/api/DiagnosticsChannel
// client --> server
// undici:request:create => { request }
//   -> [optional] undici:client:connected => { socket } [first request will create socket]
//   -> undici:client:sendHeaders => { socket, request }
//     -> undici:request:bodySent => { request }
//
// server --> client
// undici:request:headers => { request, response }
//   -> undici:request:trailers => { request, trailers }
function subscribe(name, listener) {
    diagnosticsChannel.subscribe(name, listener);
}
let kSocketReset;
function formatSocket(socket) {
    if (!socket)
        return socket;
    if (!kSocketReset) {
        const symbols = Object.getOwnPropertySymbols(socket);
        for (const symbol of symbols) {
            if (symbol.description === 'reset') {
                kSocketReset = symbol;
                break;
            }
        }
    }
    return {
        localAddress: socket[symbols.kSocketLocalAddress],
        localPort: socket[symbols.kSocketLocalPort],
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        attemptedAddresses: socket.autoSelectFamilyAttemptedAddresses,
        connecting: socket.connecting,
        reset: socket[kSocketReset],
    };
}
// make sure error contains socket info
const destroySocket = Socket.prototype.destroy;
Socket.prototype.destroy = function (err) {
    if (err) {
        Object.defineProperty(err, symbols.kErrorSocket, {
            // don't show on console log
            enumerable: false,
            value: this,
        });
    }
    return destroySocket.call(this, err);
};
function getRequestOpaque(request, kHandler) {
    if (!kHandler)
        return;
    const handler = Reflect.get(request, kHandler);
    // maxRedirects = 0 will get [Symbol(handler)]: RequestHandler {
    // responseHeaders: null,
    // opaque: {
    //   [Symbol(request id)]: 1,
    //   [Symbol(request start time)]: 465.0712921619415,
    //   [Symbol(enable request timing or not)]: true,
    //   [Symbol(request timing)]: [Object],
    //   [Symbol(request original opaque)]: undefined
    // }
    return handler?.opts?.opaque ?? handler?.opaque;
}
export function initDiagnosticsChannel() {
    // make sure init global DiagnosticsChannel once
    if (initedDiagnosticsChannel)
        return;
    initedDiagnosticsChannel = true;
    let kHandler;
    // This message is published when a new outgoing request is created.
    // Note: a request is only loosely completed to a given socket.
    subscribe('undici:request:create', (message, name) => {
        const { request } = message;
        if (!kHandler) {
            const symbols = Object.getOwnPropertySymbols(request);
            for (const symbol of symbols) {
                if (symbol.description === 'handler') {
                    kHandler = symbol;
                    break;
                }
            }
        }
        const opaque = getRequestOpaque(request, kHandler);
        // ignore non HttpClient Request
        if (!opaque || !opaque[symbols.kRequestId])
            return;
        Reflect.set(request, symbols.kRequestInternalOpaque, opaque);
        debug('[%s] Request#%d %s %s, path: %s, headers: %j', name, opaque[symbols.kRequestId], request.method, request.origin, request.path, request.headers);
        if (!opaque[symbols.kEnableRequestTiming])
            return;
        opaque[symbols.kRequestTiming].queuing = performanceTime(opaque[symbols.kRequestStartTime]);
    });
    subscribe('undici:client:connectError', (message, name) => {
        const { error, connectParams, socket } = message;
        let sock = socket;
        if (!sock && error[symbols.kErrorSocket]) {
            sock = error[symbols.kErrorSocket];
        }
        if (sock) {
            sock[symbols.kSocketId] = globalId('UndiciSocket');
            sock[symbols.kSocketConnectErrorTime] = new Date();
            sock[symbols.kHandledRequests] = 0;
            sock[symbols.kHandledResponses] = 0;
            // copy local address to symbol, avoid them be reset after request error throw
            if (sock.localAddress) {
                sock[symbols.kSocketLocalAddress] = sock.localAddress;
                sock[symbols.kSocketLocalPort] = sock.localPort;
            }
            sock[symbols.kSocketConnectProtocol] = connectParams.protocol;
            sock[symbols.kSocketConnectHost] = connectParams.host;
            sock[symbols.kSocketConnectPort] = connectParams.port;
            debug('[%s] Socket#%d connectError, connectParams: %j, error: %s, (sock: %j)', name, sock[symbols.kSocketId], connectParams, error.message, formatSocket(sock));
        }
        else {
            debug('[%s] connectError, connectParams: %j, error: %o', name, connectParams, error);
        }
    });
    // This message is published after a connection is established.
    subscribe('undici:client:connected', (message, name) => {
        const { socket, connectParams } = message;
        socket[symbols.kSocketId] = globalId('UndiciSocket');
        socket[symbols.kSocketStartTime] = performance.now();
        socket[symbols.kSocketConnectedTime] = new Date();
        socket[symbols.kHandledRequests] = 0;
        socket[symbols.kHandledResponses] = 0;
        // copy local address to symbol, avoid them be reset after request error throw
        socket[symbols.kSocketLocalAddress] = socket.localAddress;
        socket[symbols.kSocketLocalPort] = socket.localPort;
        socket[symbols.kSocketConnectProtocol] = connectParams.protocol;
        socket[symbols.kSocketConnectHost] = connectParams.host;
        socket[symbols.kSocketConnectPort] = connectParams.port;
        debug('[%s] Socket#%d connected (sock: %j)', name, socket[symbols.kSocketId], formatSocket(socket));
    });
    // This message is published right before the first byte of the request is written to the socket.
    subscribe('undici:client:sendHeaders', (message, name) => {
        const { request, socket } = message;
        const opaque = Reflect.get(request, symbols.kRequestInternalOpaque);
        if (!opaque || !opaque[symbols.kRequestId]) {
            debug('[%s] opaque not found', name);
            return;
        }
        socket[symbols.kHandledRequests]++;
        // attach socket to opaque
        opaque[symbols.kRequestSocket] = socket;
        debug('[%s] Request#%d send headers on Socket#%d (handled %d requests, sock: %j)', name, opaque[symbols.kRequestId], socket[symbols.kSocketId], socket[symbols.kHandledRequests], formatSocket(socket));
        if (!opaque[symbols.kEnableRequestTiming])
            return;
        opaque[symbols.kRequestTiming].requestHeadersSent = performanceTime(opaque[symbols.kRequestStartTime]);
        // first socket need to calculate the connected time
        if (socket[symbols.kHandledRequests] === 1) {
            // kSocketStartTime - kRequestStartTime = connected time
            opaque[symbols.kRequestTiming].connected = performanceTime(opaque[symbols.kRequestStartTime], socket[symbols.kSocketStartTime]);
        }
    });
    subscribe('undici:request:bodySent', (message, name) => {
        const { request } = message;
        const opaque = Reflect.get(request, symbols.kRequestInternalOpaque);
        if (!opaque || !opaque[symbols.kRequestId]) {
            debug('[%s] opaque not found', name);
            return;
        }
        debug('[%s] Request#%d send body', name, opaque[symbols.kRequestId]);
        if (!opaque[symbols.kEnableRequestTiming])
            return;
        opaque[symbols.kRequestTiming].requestSent = performanceTime(opaque[symbols.kRequestStartTime]);
    });
    // This message is published after the response headers have been received, i.e. the response has been completed.
    subscribe('undici:request:headers', (message, name) => {
        const { request, response } = message;
        const opaque = Reflect.get(request, symbols.kRequestInternalOpaque);
        if (!opaque || !opaque[symbols.kRequestId]) {
            debug('[%s] opaque not found', name);
            return;
        }
        // get socket from opaque
        const socket = opaque[symbols.kRequestSocket];
        if (socket) {
            socket[symbols.kHandledResponses]++;
            debug('[%s] Request#%d get %s response headers on Socket#%d (handled %d responses, sock: %j)', name, opaque[symbols.kRequestId], response.statusCode, socket[symbols.kSocketId], socket[symbols.kHandledResponses], formatSocket(socket));
        }
        else {
            debug('[%s] Request#%d get %s response headers on Unknown Socket', name, opaque[symbols.kRequestId], response.statusCode);
        }
        if (!opaque[symbols.kEnableRequestTiming])
            return;
        opaque[symbols.kRequestTiming].waiting = performanceTime(opaque[symbols.kRequestStartTime]);
    });
    // This message is published after the response body and trailers have been received, i.e. the response has been completed.
    subscribe('undici:request:trailers', (message, name) => {
        const { request } = message;
        const opaque = Reflect.get(request, symbols.kRequestInternalOpaque);
        if (!opaque || !opaque[symbols.kRequestId]) {
            debug('[%s] opaque not found', name);
            return;
        }
        debug('[%s] Request#%d get response body and trailers', name, opaque[symbols.kRequestId]);
        if (!opaque[symbols.kEnableRequestTiming])
            return;
        opaque[symbols.kRequestTiming].contentDownload = performanceTime(opaque[symbols.kRequestStartTime]);
    });
    // This message is published if the request is going to error, but it has not errored yet.
    // subscribe('undici:request:error', (message, name) => {
    //   const { request, error } = message as DiagnosticsChannel.RequestErrorMessage;
    //   const opaque = request[kHandler]?.opts?.opaque;
    //   if (!opaque || !opaque[symbols.kRequestId]) return;
    //   const socket = opaque[symbols.kRequestSocket];
    //   debug('[%s] Request#%d error on Socket#%d (handled %d responses, sock: %o), error: %o',
    //     name, opaque[symbols.kRequestId], socket[symbols.kSocketId], socket[symbols.kHandledResponses],
    //     formatSocket(socket), error);
    // });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhZ25vc3RpY3NDaGFubmVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2RpYWdub3N0aWNzQ2hhbm5lbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLGtCQUFrQixNQUFNLDBCQUEwQixDQUFDO0FBQzFELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDbEMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFJckMsNkRBQTZEO0FBQzdELGFBQWE7QUFDYixPQUFPLE9BQU8sTUFBTSxjQUFjLENBQUM7QUFDbkMsT0FBTyxFQUFFLFFBQVEsRUFBRSxlQUFlLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFdkQsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLDJCQUEyQixDQUFDLENBQUM7QUFDcEQsSUFBSSx3QkFBd0IsR0FBRyxLQUFLLENBQUM7QUFDckMsMERBQTBEO0FBQzFELG9CQUFvQjtBQUNwQix1Q0FBdUM7QUFDdkMsMkZBQTJGO0FBQzNGLHdEQUF3RDtBQUN4RCxnREFBZ0Q7QUFDaEQsRUFBRTtBQUNGLG9CQUFvQjtBQUNwQixrREFBa0Q7QUFDbEQsd0RBQXdEO0FBRXhELFNBQVMsU0FBUyxDQUFDLElBQVksRUFBRSxRQUFrRTtJQUNqRyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFNRCxJQUFJLFlBQW9CLENBQUM7QUFDekIsU0FBUyxZQUFZLENBQUMsTUFBb0I7SUFDeEMsSUFBSSxDQUFDLE1BQU07UUFBRSxPQUFPLE1BQU0sQ0FBQztJQUMzQixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDbEIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JELEtBQUssTUFBTSxNQUFN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
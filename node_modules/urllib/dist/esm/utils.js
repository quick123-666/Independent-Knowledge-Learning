import { Blob, File } from 'node:buffer';
import { randomBytes, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Readable } from 'node:stream';
import { ReadableStream, TransformStream } from 'node:stream/web';
import { toUSVString } from 'node:util';
import symbols from './symbols.js';
const JSONCtlCharsMap = {
    '"': '\\"', // \u0022
    '\\': '\\\\', // \u005c
    '\b': '\\b', // \u0008
    '\f': '\\f', // \u000c
    '\n': '\\n', // \u000a
    '\r': '\\r', // \u000d
    '\t': '\\t', // \u0009
};
/* eslint no-control-regex: "off"*/
const JSONCtlCharsRE = /[\u0000-\u001F\u005C]/g;
function replaceOneChar(c) {
    return JSONCtlCharsMap[c] || '\\u' + (c.charCodeAt(0) + 0x10000).toString(16).substring(1);
}
function replaceJSONCtlChars(value) {
    return value.replace(JSONCtlCharsRE, replaceOneChar);
}
export function parseJSON(data, fixJSONCtlChars) {
    if (typeof fixJSONCtlChars === 'function') {
        data = fixJSONCtlChars(data);
    }
    else if (fixJSONCtlChars) {
        // https://github.com/node-modules/urllib/pull/77
        // remote the control characters (U+0000 through U+001F)
        data = replaceJSONCtlChars(data);
    }
    try {
        data = JSON.parse(data);
    }
    catch (err) {
        if (err.name === 'SyntaxError') {
            err.name = 'JSONResponseFormatError';
        }
        if (data.length > 1024) {
            // show 0~512 ... -512~end data
            err.message +=
                ' (data json format: ' +
                    JSON.stringify(data.slice(0, 512)) +
                    ' ...skip... ' +
                    JSON.stringify(data.slice(data.length - 512)) +
                    ')';
        }
        else {
            err.message += ' (data json format: ' + JSON.stringify(data) + ')';
        }
        throw err;
    }
    return data;
}
function md5(s) {
    const sum = createHash('md5');
    sum.update(s, 'utf8');
    return sum.digest('hex');
}
const AUTH_KEY_VALUE_RE = /(\w{1,100})=["']?([^'"]+)["']?/;
let NC = 0;
const NC_PAD = '00000000';
export function digestAuthHeader(method, uri, wwwAuthenticate, userpass) {
    // WWW-Authenticate: Digest realm="testrealm@host.com",
    //                       qop="auth,auth-int",
    //                       nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093",
    //                       opaque="5ccc069c403ebaf9f0171e9517f40e41"
    // Authorization: Digest username="Mufasa",
    //                    realm="testrealm@host.com",
    //                    nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093",
    //                    uri="/dir/index.html",
    //                    qop=auth,
    //                    nc=00000001,
    //                    cnonce="0a4f113b",
    //                    response="6629fae49393a05397450978507c4ef1",
    //                    opaque="5ccc069c403ebaf9f0171e9517f40e41"
    // HA1 = MD5( "Mufasa:testrealm@host.com:Circle Of Life" )
    //      = 939e7578ed9e3c518a452acee763bce9
    //
    //  HA2 = MD5( "GET:/dir/index.html" )
    //      = 39aff3a2bab6126f332b942af96d3366
    //
    //  Response = MD5( "939e7578ed9e3c518a452acee763bce9:\
    //                   dcd98b7102dd2f0e8b11d0f600bfb0c093:\
    //                   00000001:0a4f113b:auth:\
    //                   39aff3a2bab6126f332b942af96d3366" )
    //           = 6629fae49393a05397450978507c4ef1
    const parts = wwwAuthenticate.split(',');
    const opts = {};
    for (const part of parts) {
        const m = part.match(AUTH_KEY_VALUE_RE);
        if (m) {
            opts[m[1]] = m[2].replace(/["']/g, '');
        }
    }
    if (!opts.realm || !opts.nonce) {
        return '';
    }
    let qop = opts.qop || '';
    const index = userpass.indexOf(':');
    const user = userpass.substring(0, index);
    const pass = userpass.substring(index + 1);
    let nc = String(++NC);
    nc = `${NC_PAD.substring(nc.length)}${nc}`;
    const cnonce = randomBytes(8).toString('hex');
    const ha1 = md5(`${user}:${opts.realm}:${pass}`);
    const ha2 = md5(`${method.toUpperCase()}:${uri}`);
    let s = `${ha1}:${opts.nonce}`;
    if (qop) {
        qop = qop.split(',')[0];
        s += `:${nc}:${cnonce}:${qop}`;
    }
    s += `:${ha2}`;
    const response = md5(s);
    let authstring = `Digest username="${user}", realm="${opts.realm}", nonce="${opts.nonce}", uri="${uri}", response="${response}"`;
    if (opts.opaque) {
        authstring += `, opaque="${opts.opaque}"`;
    }
    if (qop) {
        authstring += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
    }
    return authstring;
}
const MAX_ID_VALUE = Math.pow(2, 31) - 10;
const globalIds = {};
export function globalId(category) {
    if (!globalIds[category] || globalIds[category] >= MAX_ID_VALUE) {
        globalIds[category] = 0;
    }
    return ++globalIds[category];
}
export function performanceTime(startTime, now) {
    return Math.floor(((now ?? performance.now()) - startTime) * 1000) / 1000;
}
export function isReadable(stream) {
    if (typeof Readable.isReadable === 'function')
        return Readable.isReadable(stream);
    // patch from node
    // https://github.com/nodejs/node/blob/1287530385137dda1d44975063217ccf90759475/lib/internal/streams/utils.js#L119
    // simple way https://github.com/sindresorhus/is-stream/blob/main/index.js
    return (stream !== null &&
        typeof stream === 'object' &&
        typeof stream.pipe === 'function' &&
        stream.readable !== false &&
        typeof stream._read === 'function' &&
        typeof stream._readableState === 'object');
}
export function updateSocketInfo(socketInfo, internalOpaque, err) {
    const socket = internalOpaque[symbols.kRequestSocket] ?? err?.[symbols.kErrorSocket];
    if (socket) {
        socketInfo.id = socket[symbols.kSocketId];
        socketInfo.handledRequests = socket[symbols.kHandledRequests];
        socketInfo.handledResponses = socket[symbols.kHandledResponses];
        if (socket[symbols.kSocketLocalAddress]) {
            socketInfo.localAddress = socket[symbols.kSocketLocalAddress];
            socketInfo.localPort = socket[symbols.kSocketLocalPort];
        }
        if (socket.remoteAddress) {
            socketInfo.remoteAddress = socket.remoteAddress;
            socketInfo.remotePort = socket.remotePort;
            socketInfo.remoteFamily = socket.remoteFamily;
        }
        if (Array.isArray(socket.autoSelectFamilyAttemptedAddresses)) {
            socketInfo.attemptedRemoteAddresses = socket.autoSelectFamilyAttemptedAddresses;
        }
        socketInfo.bytesRead = socket.bytesRead;
        socketInfo.bytesWritten = socket.bytesWritten;
        if (socket[symbols.kSocketConnectErrorTime]) {
            socketInfo.connectErrorTime = socket[symbols.kSocketConnectErrorTime];
            socketInfo.connectProtocol = socket[symbols.kSocketConnectProtocol];
            socketInfo.connectHost = socket[symbols.kSocketConnectHost];
            socketInfo.connectPort = socket[symbols.kSocketConnectPort];
        }
        if (socket[symbols.kSocketConnectedTime]) {
            socketInfo.connectedTime = socket[symbols.kSocketConnectedTime];
        }
        if (socket[symbols.kSocketRequestEndTime]) {
            socketInfo.lastRequestEndTime = socket[symbols.kSocketRequestEndTime];
        }
        socket[symbols.kSocketRequestEndTime] = new Date();
    }
}
export function convertHeader(headers) {
    const res = {};
    for (const [key, value] of headers.entries()) {
        if (res[key]) {
            if (!Array.isArray(res[key])) {
                res[key] = [res[key]];
            }
            res[key].push(value);
        }
        else {
            res[key] = value;
        }
    }
    return res;
}
// support require from Node.js 16
export function patchForNode16() {
    if (typeof global.ReadableStream === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.ReadableStream = ReadableStream;
    }
    if (typeof global.TransformStream === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.TransformStream = TransformStream;
    }
    if (typeof global.Blob === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.Blob = Blob;
    }
    if (typeof global.DOMException === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.DOMException = getDOMExceptionClass();
    }
    // multi undici version in node version less than 20 https://github.com/nodejs/undici/issues/4374
    if (typeof global.File === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.File = File;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (String.prototype.toWellFormed === undefined) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        Object.defineProperty(String.prototype, 'toWellFormed', {
            value: function () {
                return toUSVString(this);
            },
            enumerable: false,
            configurable: true,
            writable: true,
        });
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (String.prototype.isWellFormed === undefined) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        Object.defineProperty(String.prototype, 'isWellFormed', {
            value: function () {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                return toUSVString(this) === this;
            },
            enumerable: false,
            configurable: true,
            writable: true,
        });
    }
}
// https://github.com/jimmywarting/node-domexception/blob/main/index.js
function getDOMExceptionClass() {
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        atob(0);
    }
    catch (err) {
        return err.constructor;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDekMsT0FBTyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDdEQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDdkMsT0FBTyxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNsRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBS3hDLE9BQU8sT0FBTyxNQUFNLGNBQWMsQ0FBQztBQUVuQyxNQUFNLGVBQWUsR0FBMkI7SUFDOUMsR0FBRyxFQUFFLEtBQUssRUFBRSxTQUFTO0lBQ3JCLElBQUksRUFBRSxNQUFNLEVBQUUsU0FBUztJQUN2QixJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVM7SUFDdEIsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTO0lBQ3RCLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUztJQUN0QixJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVM7SUFDdEIsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTO0NBQ3ZCLENBQUM7QUFDRixtQ0FBbUM7QUFDbkMsTUFBTSxjQUFjLEdBQUcsd0JBQXdCLENBQUM7QUFFaEQsU0FBUyxjQUFjLENBQUMsQ0FBUztJQUMvQixPQUFPLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0YsQ0FBQztBQUVE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
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJSON = parseJSON;
exports.digestAuthHeader = digestAuthHeader;
exports.globalId = globalId;
exports.performanceTime = performanceTime;
exports.isReadable = isReadable;
exports.updateSocketInfo = updateSocketInfo;
exports.convertHeader = convertHeader;
exports.patchForNode16 = patchForNode16;
const node_buffer_1 = require("node:buffer");
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const node_stream_1 = require("node:stream");
const web_1 = require("node:stream/web");
const node_util_1 = require("node:util");
const symbols_js_1 = __importDefault(require("./symbols.js"));
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
function parseJSON(data, fixJSONCtlChars) {
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
    const sum = (0, node_crypto_1.createHash)('md5');
    sum.update(s, 'utf8');
    return sum.digest('hex');
}
const AUTH_KEY_VALUE_RE = /(\w{1,100})=["']?([^'"]+)["']?/;
let NC = 0;
const NC_PAD = '00000000';
function digestAuthHeader(method, uri, wwwAuthenticate, userpass) {
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
    const cnonce = (0, node_crypto_1.randomBytes)(8).toString('hex');
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
function globalId(category) {
    if (!globalIds[category] || globalIds[category] >= MAX_ID_VALUE) {
        globalIds[category] = 0;
    }
    return ++globalIds[category];
}
function performanceTime(startTime, now) {
    return Math.floor(((now ?? node_perf_hooks_1.performance.now()) - startTime) * 1000) / 1000;
}
function isReadable(stream) {
    if (typeof node_stream_1.Readable.isReadable === 'function')
        return node_stream_1.Readable.isReadable(stream);
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
function updateSocketInfo(socketInfo, internalOpaque, err) {
    const socket = internalOpaque[symbols_js_1.default.kRequestSocket] ?? err?.[symbols_js_1.default.kErrorSocket];
    if (socket) {
        socketInfo.id = socket[symbols_js_1.default.kSocketId];
        socketInfo.handledRequests = socket[symbols_js_1.default.kHandledRequests];
        socketInfo.handledResponses = socket[symbols_js_1.default.kHandledResponses];
        if (socket[symbols_js_1.default.kSocketLocalAddress]) {
            socketInfo.localAddress = socket[symbols_js_1.default.kSocketLocalAddress];
            socketInfo.localPort = socket[symbols_js_1.default.kSocketLocalPort];
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
        if (socket[symbols_js_1.default.kSocketConnectErrorTime]) {
            socketInfo.connectErrorTime = socket[symbols_js_1.default.kSocketConnectErrorTime];
            socketInfo.connectProtocol = socket[symbols_js_1.default.kSocketConnectProtocol];
            socketInfo.connectHost = socket[symbols_js_1.default.kSocketConnectHost];
            socketInfo.connectPort = socket[symbols_js_1.default.kSocketConnectPort];
        }
        if (socket[symbols_js_1.default.kSocketConnectedTime]) {
            socketInfo.connectedTime = socket[symbols_js_1.default.kSocketConnectedTime];
        }
        if (socket[symbols_js_1.default.kSocketRequestEndTime]) {
            socketInfo.lastRequestEndTime = socket[symbols_js_1.default.kSocketRequestEndTime];
        }
        socket[symbols_js_1.default.kSocketRequestEndTime] = new Date();
    }
}
function convertHeader(headers) {
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
function patchForNode16() {
    if (typeof global.ReadableStream === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.ReadableStream = web_1.ReadableStream;
    }
    if (typeof global.TransformStream === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.TransformStream = web_1.TransformStream;
    }
    if (typeof global.Blob === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.Blob = node_buffer_1.Blob;
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
        global.File = node_buffer_1.File;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (String.prototype.toWellFormed === undefined) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        Object.defineProperty(String.prototype, 'toWellFormed', {
            value: function () {
                return (0, node_util_1.toUSVString)(this);
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
                return (0, node_util_1.toUSVString)(this) === this;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFnQ0EsOEJBNEJDO0FBWUQsNENBZ0VDO0FBS0QsNEJBS0M7QUFFRCwwQ0FFQztBQUVELGdDQWFDO0FBRUQsNENBbUNDO0FBRUQsc0NBYUM7QUFHRCx3Q0EyREM7QUF2UkQsNkNBQXlDO0FBQ3pDLDZDQUFzRDtBQUN0RCxxREFBOEM7QUFDOUMsNkNBQXVDO0FBQ3ZDLHlDQUFrRTtBQUNsRSx5Q0FBd0M7QUFLeEMsOERBQW1DO0FBRW5DLE1BQU0sZUFBZSxHQUEyQjtJQUM5QyxHQUFHLEVBQUUsS0FBSyxFQUFFLFNBQVM7SUFDckIsSUFBSSxFQUFFLE1BQU0sRUFBRSxTQUFTO0lBQ3ZCLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUztJQUN0QixJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVM7SUFDdEIsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTO0lBQ3RCLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUztJQUN0QixJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVM7Q0FDdkIsQ0FBQztBQUNGLG1DQUFtQztBQUNuQyxNQUFNLGNBQWMsR0FBRyx3QkFBd0IsQ0FBQztBQUVoRCxTQUFTLGNBQWMsQ0FBQyxDQUFTO0lBQy9CLE9BQU8sZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3RixDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxLQUFhO0lBQ3hDLE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFDdkQsQ0FBQztBQUVELFNBQWdCLFNBQVMsQ0FBQyxJQUFZLEVBQUUs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RSxDQUFDLENBQUM7UUFDekMsQ0FBQztJQUNILENBQUM7SUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMvQixPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFFRCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQztJQUN6QixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzFDLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBRTNDLElBQUksRUFBRSxHQUFHLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3RCLEVBQUUsR0FBRyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDO0lBQzNDLE1BQU0sTUFBTSxHQUFHLElBQUEseUJBQVcsRUFBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFOUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNqRCxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNsRCxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDL0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNSLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3hC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
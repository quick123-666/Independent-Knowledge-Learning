import { HttpClient } from './HttpClient.js';
import type { RequestOptions, RequestURL } from './Request.js';
import type { HttpClientResponse } from './Response.js';
export declare function getDefaultHttpClient(rejectUnauthorized?: boolean, allowH2?: boolean): HttpClient;
interface UrllibRequestOptions extends RequestOptions {
    /**
     * If `true`, the server certificate is verified against the list of supplied CAs.
     * An 'error' event is emitted if verification fails.
     * Default: `true`
     */
    rejectUnauthorized?: boolean;
    /** Allow to use HTTP2 first. Default is `false` */
    allowH2?: boolean;
}
export declare function request<T = any>(url: RequestURL, options?: UrllibRequestOptions): Promise<HttpClientResponse<T>>;
export declare function curl<T = any>(url: RequestURL, options?: UrllibRequestOptions): Promise<HttpClientResponse<T>>;
export { MockAgent, ProxyAgent, Agent, Dispatcher, setGlobalDispatcher, getGlobalDispatcher, Request, Response, Headers, FormData, } from 'undici';
export type { RequestInfo, RequestInit, BodyInit, ResponseInit } from 'undici';
export { HttpClient, HttpClient as HttpClient2, HEADER_USER_AGENT as USER_AGENT } from './HttpClient.js';
export type { RequestDiagnosticsMessage, ResponseDiagnosticsMessage, ClientOptions } from './HttpClient.js';
export type { RequestOptions, RequestOptions as RequestOptions2, RequestURL, HttpMethod, FixJSONCtlCharsHandler, FixJSONCtlChars, } from './Request.js';
export type { CheckAddressFunction } from './HttpAgent.js';
export type { SocketInfo, Timing, RawResponseWithMeta, HttpClientResponse } from './Response.js';
export type { IncomingHttpHeaders } from './IncomingHttpHeaders.js';
export * from './HttpClientError.js';
export { FetchFactory, fetch } from './fetch.js';
export { FormData as WebFormData } from './FormData.js';
declare const urllib: {
    request: typeof request;
    curl: typeof curl;
    USER_AGENT: string;
};
export default urllib;

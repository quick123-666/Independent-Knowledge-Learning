import { Response, Agent, Dispatcher } from 'undici';
import type { RequestInfo, RequestInit } from 'undici';
import type { FetchOpaque } from './FetchOpaqueInterceptor.js';
import type { ClientOptions, PoolStat, UndiciTimingInfo } from './HttpClient.js';
import type { FetchMeta } from './Request.js';
export interface UrllibRequestInit extends RequestInit {
    timing?: boolean;
}
export type FetchDiagnosticsMessage = {
    fetch: FetchMeta;
    fetchOpaque: FetchOpaque;
};
export type FetchResponseDiagnosticsMessage = {
    fetch: FetchMeta;
    fetchOpaque: FetchOpaque;
    timingInfo?: UndiciTimingInfo;
    response?: Response;
    error?: Error;
};
export declare class FetchFactory {
    #private;
    setClientOptions(clientOptions: ClientOptions): void;
    getDispatcher(): Dispatcher;
    setDispatcher(dispatcher: Agent): void;
    getDispatcherPoolStats(): Record<string, PoolStat>;
    static setClientOptions(clientOptions: ClientOptions): void;
    static getDispatcherPoolStats(): Record<string, PoolStat>;
    fetch(input: RequestInfo, init?: UrllibRequestInit): Promise<Response>;
    static getDispatcher(): Dispatcher;
    static setDispatcher(dispatcher: Agent): void;
    static fetch(input: RequestInfo, init?: UrllibRequestInit): Promise<Response>;
}
export declare const fetch: (input: RequestInfo, init?: UrllibRequestInit) => Promise<Response>;

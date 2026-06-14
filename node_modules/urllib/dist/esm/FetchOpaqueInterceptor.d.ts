import { AsyncLocalStorage } from 'node:async_hooks';
import symbols from './symbols.js';
export interface FetchOpaque {
    [symbols.kRequestId]: number;
    [symbols.kRequestStartTime]: number;
    [symbols.kEnableRequestTiming]: boolean;
}
export interface OpaqueInterceptorOptions {
    opaqueLocalStorage: AsyncLocalStorage<FetchOpaque>;
}

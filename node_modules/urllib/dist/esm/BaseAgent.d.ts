import { AsyncLocalStorage } from 'node:async_hooks';
import { Agent, Dispatcher } from 'undici';
import type { FetchOpaque } from './FetchOpaqueInterceptor.js';
export interface BaseAgentOptions extends Agent.Options {
    opaqueLocalStorage?: AsyncLocalStorage<FetchOpaque>;
}
export declare class BaseAgent extends Agent {
    #private;
    constructor(options: BaseAgentOptions);
    dispatch(options: Agent.DispatchOptions, handler: Dispatcher.DispatchHandler): boolean;
}

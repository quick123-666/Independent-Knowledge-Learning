"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebFormData = exports.FetchFactory = exports.USER_AGENT = exports.HttpClient2 = exports.HttpClient = exports.FormData = exports.Headers = exports.Response = exports.Request = exports.getGlobalDispatcher = exports.setGlobalDispatcher = exports.Dispatcher = exports.Agent = exports.ProxyAgent = exports.MockAgent = void 0;
exports.getDefaultHttpClient = getDefaultHttpClient;
exports.request = request;
exports.curl = curl;
const ylru_1 = require("ylru");
const utils_js_1 = require("./utils.js");
(0, utils_js_1.patchForNode16)();
const HttpClient_js_1 = require("./HttpClient.js");
let httpClient;
let allowH2HttpClient;
let allowUnauthorizedHttpClient;
let allowH2AndUnauthorizedHttpClient;
const domainSocketHttpClients = new ylru_1.LRU(50);
function getDefaultHttpClient(rejectUnauthorized, allowH2) {
    if (rejectUnauthorized === false) {
        if (allowH2) {
            if (!allowH2AndUnauthorizedHttpClient) {
                allowH2AndUnauthorizedHttpClient = new HttpClient_js_1.HttpClient({
                    allowH2,
                    connect: {
                        rejectUnauthorized,
                    },
                });
            }
            return allowH2AndUnauthorizedHttpClient;
        }
        if (!allowUnauthorizedHttpClient) {
            allowUnauthorizedHttpClient = new HttpClient_js_1.HttpClient({
                connect: {
                    rejectUnauthorized,
                },
            });
        }
        return allowUnauthorizedHttpClient;
    }
    if (allowH2) {
        if (!allowH2HttpClient) {
            allowH2HttpClient = new HttpClient_js_1.HttpClient({
                allowH2,
            });
        }
        return allowH2HttpClient;
    }
    if (!httpClient) {
        httpClient = new HttpClient_js_1.HttpClient();
    }
    return httpClient;
}
async function request(url, options) {
    if (options?.socketPath) {
        let domainSocketHttpclient = domainSocketHttpClients.get(options.socketPath);
        if (!domainSocketHttpclient) {
            domainSocketHttpclient = new HttpClient_js_1.HttpClient({
                connect: { socketPath: options.socketPath },
            });
            domainSocketHttpClients.set(options.socketPath, domainSocketHttpclient);
        }
        return await domainSocketHttpclient.request(url, options);
    }
    return await getDefaultHttpClient(options?.rejectUnauthorized, options?.allowH2).request(url, options);
}
// export curl method is keep compatible with urllib.curl()
// ```ts
// import * as urllib from 'urllib';
// urllib.curl(url);
// ```
async function curl(url, options) {
    return await request(url, options);
}
var undici_1 = require("undici");
Object.defineProperty(exports, "MockAgent", { enumerable: true, get: function () { return undici_1.MockAgent; } });
Object.defineProperty(exports, "ProxyAgent", { enumerable: true, get: function () { return undici_1.ProxyAgent; } });
Object.defineProperty(exports, "Agent", { enumerable: true, get: function () { return undici_1.Agent; } });
Object.defineProperty(exports, "Dispatcher", { enumerable: true, get: function () { return undici_1.Dispatcher; } });
Object.defineProperty(exports, "setGlobalDispatcher", { enumerable: true, get: function () { return undici_1.setGlobalDispatcher; } });
Object.defineProperty(exports, "getGlobalDispatcher", { enumerable: true, get: function () { return undici_1.getGlobalDispatcher; } });
Object.defineProperty(exports, "Request", { enumerable: true, get: function () { return undici_1.Request; } });
Object.defineProperty(exports, "Response", { enumerable: true, get: function () { return undici_1.Response; } });
Object.defineProperty(exports, "Headers", { enumerable: true, get: function () { return undici_1.Headers; } });
Object.defineProperty(exports, "FormData", { enumerable: true, get: function () { return undici_1.FormData; } });
// HttpClient2 is keep compatible with urllib@2 HttpClient2
var HttpClient_js_2 = require("./HttpClient.js");
Object.defineProperty(exports, "HttpClient", { enumerable: true, get: function () { return HttpClient_js_2.HttpClient; } });
Object.defineProperty(exports, "HttpClient2", { enumerable: true, get: function () { return HttpClient_js_2.HttpClient; } });
Object.defineProperty(exports, "USER_AGENT", { enumerable: true, get: function () { return HttpClient_js_2.HEADER_USER_AGENT; } });
__exportStar(require("./HttpClientError.js"), exports);
var fetch_js_1 = require("./fetch.js");
Object.defineProperty(exports, "FetchFactory", { enumerable: true, get: function () { return fetch_js_1.FetchFactory; } });
Object.defineProperty(exports, "fetch", { enumerable: true, get: function () { return fetch_js_1.fetch; } });
var FormData_js_1 = require("./FormData.js");
Object.defineProperty(exports, "WebFormData", { enumerable: true, get: function () { return FormData_js_1.FormData; } });
const urllib = {
    request,
    curl,
    USER_AGENT: HttpClient_js_1.HEADER_USER_AGENT,
};
exports.default = urllib;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsb0RBcUNDO0FBYUQsMEJBZ0JDO0FBT0Qsb0JBRUM7QUEzRkQsK0JBQTJCO0FBRTNCLHlDQUE0QztBQUU1QyxJQUFBLHlCQUFjLEdBQUUsQ0FBQztBQUVqQixtREFBZ0U7QUFJaEUsSUFBSSxVQUFzQixDQUFDO0FBQzNCLElBQUksaUJBQTZCLENBQUM7QUFDbEMsSUFBSSwyQkFBdUMsQ0FBQztBQUM1QyxJQUFJLGdDQUE0QyxDQUFDO0FBQ2pELE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxVQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFFNUMsU0FBZ0Isb0JBQW9CLENBQUMsa0JBQTRCLEVBQUUsT0FBaUI7SUFDbEYsSUFBSSxrQkFBa0IsS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUNqQyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLGdDQUFnQyxFQUFFLENBQUM7Z0JBQ3RDLGdDQUFnQyxHQUFHLElBQUksMEJBQVUsQ0FBQztvQkFDaEQsT0FBTztvQkFDUCxPQUFPLEVBQUU7d0JBQ1Asa0JBQWtCO3FCQUNuQjtpQkFDRixDQUFDLENBQUM7WUFDTCxDQUFDO1lBQ0QsT0FBTyxnQ0FBZ0MsQ0FBQztRQUMxQyxDQUFDO1FBRUQsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7WUFDakMsMkJBQTJCLEdBQUcsSUFBSSwwQkFBVSxDQUFDO2dCQUMzQyxPQUFPLEVBQUU7b0JBQ1Asa0JBQWtCO2lCQUNuQjthQUNGLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDRCxPQUFPLDJCQUEyQixDQUFDO0lBQ3JDLENBQUM7SUFFRCxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQ1osSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDdkIsaUJBQWlCLEdBQUcsSUFBSSwwQkFBVSxDQUFDO2dCQUNqQyxPQUFPO2FBQ1IsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNELE9BQU8saUJBQWlCLENBQUM7SUFDM0IsQ0FBQztJQUVELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNoQixVQUFVLEdBQUcsSUFBSSwwQkFBVSxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUNELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFhTSxLQUFLLFVBQVUsT0FBTyxDQUMzQixHQUFlLEVBQ2YsT0FBOEI7SUFFOUIsSUFBSSxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUM7UUFDeEIsSUFBSSxzQkFBc0IsR0FBRyx1QkFBdUIsQ0FBQyxHQUFHLENBQWEsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pGLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1lBQzVCLHNCQUFzQixHQUFHLElBQUksMEJBQVUsQ0FBQztnQkFDdEMsT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVLEVBQUU7YUFDNUMsQ0FBQyxDQUFDO1lBQ0gsdUJBQXVCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBQ0QsT0FBTyxNQUFNLHNCQUFzQixDQUFDLE9BQU8sQ0FBSSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVELE9BQU8sTUFBTSxvQkFBb0IsQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBSSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDNUcsQ0FBQztBQUVELDJEQUEyRDtBQUMzRCxRQUFRO0FBQ1Isb0NBQW9DO0FBQ3BDLG9CQUFvQjtBQUNwQixNQUFNO0FBQ0MsS0FBSyxVQUFVLElBQUksQ0FBVSxHQUFlLEVBQUUsT0FBOEI7SUFDakYsT0FBTyxNQUFNLE9BQU8sQ0FBSSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDeEMsQ0FBQztBQUVELGlDQVdnQjtBQVZkLG1HQUFBLFNBQVMsT0FBQTtBQUNULG9HQUFBLFVBQVUsT0FBQTtBQUNWLCtGQUFBLEtBQUssT0FBQTtBQUNMLG9HQUFBLFVBQVUsT0FBQTtBQUNWLDZHQUFBLG1CQUFtQixPQUFBO0FBQ25CLDZHQUFBLG1CQUFtQixPQUFBO0FBQ25CLGlHQUFBLE9BQU8sT0FBQTtBQUNQLGtHQUFBLFFBQVEsT0FBQTtBQUNSLGlHQUFBLE9BQU8sT0FBQTtBQUNQLGtHQUFBLFFBQVEsT0FBQTtBQUdWLDJEQUEyRDtBQUMzRCxpREFBeUc7QUFBaEcsMkdBQUEsVUFBVSxPQUFBO0FBQUUsNEdBQUEsVUFBVSxPQUFlO0FBQUUsMkdBQUEsaUJBQWlCLE9BQWM7QUFnQi9FLHVEQUFxQztBQUNyQyx1Q0FBaUQ7QUFBeEMsd0dBQUEsWUFBWSxPQUFBO0FBQUUsaUdBQUEsS0FBSyxPQUFBO0FBQzVCLDZDQUF3RDtBQUEvQywwR0FBQSxRQUFRLE9BQWU7QUFFaEMsTUFBTSxNQUFNLEdBSVI7SUFDRixPQUFPO0lBQ1AsSUFBSTtJQUNKLFVBQVUsRUFBRSxpQ0FBaUI7Q0FDOUIsQ0FBQztBQUVGLGtCQUFlLE1BQU0sQ0FBQyJ9
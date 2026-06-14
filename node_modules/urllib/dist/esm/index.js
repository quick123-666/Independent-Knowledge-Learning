import { LRU } from 'ylru';
import { patchForNode16 } from './utils.js';
patchForNode16();
import { HttpClient, HEADER_USER_AGENT } from './HttpClient.js';
let httpClient;
let allowH2HttpClient;
let allowUnauthorizedHttpClient;
let allowH2AndUnauthorizedHttpClient;
const domainSocketHttpClients = new LRU(50);
export function getDefaultHttpClient(rejectUnauthorized, allowH2) {
    if (rejectUnauthorized === false) {
        if (allowH2) {
            if (!allowH2AndUnauthorizedHttpClient) {
                allowH2AndUnauthorizedHttpClient = new HttpClient({
                    allowH2,
                    connect: {
                        rejectUnauthorized,
                    },
                });
            }
            return allowH2AndUnauthorizedHttpClient;
        }
        if (!allowUnauthorizedHttpClient) {
            allowUnauthorizedHttpClient = new HttpClient({
                connect: {
                    rejectUnauthorized,
                },
            });
        }
        return allowUnauthorizedHttpClient;
    }
    if (allowH2) {
        if (!allowH2HttpClient) {
            allowH2HttpClient = new HttpClient({
                allowH2,
            });
        }
        return allowH2HttpClient;
    }
    if (!httpClient) {
        httpClient = new HttpClient();
    }
    return httpClient;
}
export async function request(url, options) {
    if (options?.socketPath) {
        let domainSocketHttpclient = domainSocketHttpClients.get(options.socketPath);
        if (!domainSocketHttpclient) {
            domainSocketHttpclient = new HttpClient({
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
export async function curl(url, options) {
    return await request(url, options);
}
export { MockAgent, ProxyAgent, Agent, Dispatcher, setGlobalDispatcher, getGlobalDispatcher, Request, Response, Headers, FormData, } from 'undici';
// HttpClient2 is keep compatible with urllib@2 HttpClient2
export { HttpClient, HttpClient as HttpClient2, HEADER_USER_AGENT as USER_AGENT } from './HttpClient.js';
export * from './HttpClientError.js';
export { FetchFactory, fetch } from './fetch.js';
export { FormData as WebFormData } from './FormData.js';
const urllib = {
    request,
    curl,
    USER_AGENT: HEADER_USER_AGENT,
};
export default urllib;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUUzQixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRTVDLGNBQWMsRUFBRSxDQUFDO0FBRWpCLE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUloRSxJQUFJLFVBQXNCLENBQUM7QUFDM0IsSUFBSSxpQkFBNkIsQ0FBQztBQUNsQyxJQUFJLDJCQUF1QyxDQUFDO0FBQzVDLElBQUksZ0NBQTRDLENBQUM7QUFDakQsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUU1QyxNQUFNLFVBQVUsb0JBQW9CLENBQUMsa0JBQTRCLEVBQUUsT0FBaUI7SUFDbEYsSUFBSSxrQkFBa0IsS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUNqQyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLGdDQUFnQyxFQUFFLENBQUM7Z0JBQ3RDLGdDQUFnQyxHQUFHLElBQUksVUFBVSxDQUFDO29CQUNoRCxPQUFPO29CQUNQLE9BQU8sRUFBRTt3QkFDUCxrQkFBa0I7cUJBQ25CO2lCQUNGLENBQUMsQ0FBQztZQUNMLENBQUM7WUFDRCxPQUFPLGdDQUFnQyxDQUFDO1FBQzFDLENBQUM7UUFFRCxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztZQUNqQywyQkFBMkIsR0FBRyxJQUFJLFVBQVUsQ0FBQztnQkFDM0MsT0FBTyxFQUFFO29CQUNQLGtCQUFrQjtpQkFDbkI7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0QsT0FBTywyQkFBMkIsQ0FBQztJQUNyQyxDQUFDO0lBRUQsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUNaLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ3ZCLGlCQUFpQixHQUFHLElBQUksVUFBVSxDQUFDO2dCQUNqQyxPQUFPO2FBQ1IsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNELE9BQU8saUJBQWlCLENBQUM7SUFDM0IsQ0FBQztJQUVELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNoQixVQUFVLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQztJQUNoQyxDQUFDO0lBQ0QsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQztBQWFELE1BQU0sQ0FBQyxLQUFLLFVBQVUsT0FBTyxDQUMzQixHQUFlLEVBQ2YsT0FBOEI7SUFFOUIsSUFBSSxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUM7UUFDeEIsSUFBSSxzQkFBc0IsR0FBRyx1QkFBdUIsQ0FBQyxHQUFHLENBQWEsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pGLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1lBQzVCLHNCQUFzQixHQUFHLElBQUksVUFBVSxDQUFDO2dCQUN0QyxPQUFPLEVBQUUsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsRUFBRTthQUM1QyxDQUFDLENBQUM7WUFDSCx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQzFFLENBQUM7UUFDRCxPQUFPLE1BQU0sc0JBQXNCLENBQUMsT0FBTyxDQUFJLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRUQsT0FBTyxNQUFNLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFJLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUM1RyxDQUFDO0FBRUQsMkRBQTJEO0FBQzNELFFBQVE7QUFDUixvQ0FBb0M7QUFDcEMsb0JBQW9CO0FBQ3BCLE1BQU07QUFDTixNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FBVSxHQUFlLEVBQUUsT0FBOEI7SUFDakYsT0FBTyxNQUFNLE9BQU8sQ0FBSSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDeEMsQ0FBQztBQUVELE9BQU8sRUFDTCxTQUFTLEVBQ1QsVUFBVSxFQUNWLEtBQUssRUFDTCxVQUFVLEVBQ1YsbUJBQW1CLEVBQ25CLG1CQUFtQixFQUNuQixPQUFPLEVBQ1AsUUFBUSxFQUNSLE9BQU8sRUFDUCxRQUFRLEdBQ1QsTUFBTSxRQUFRLENBQUM7QUFFaEIsMkRBQTJEO0FBQzNELE9BQU8sRUFBRSxVQUFVLEVBQUUsVUFBVSxJQUFJLFdBQVcsRUFBRSxpQkFBaUIsSUFBSSxVQUFVLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQWdCekcsY0FBYyxzQkFBc0IsQ0FBQztBQUNyQyxPQUFPLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNqRCxPQUFPLEVBQUUsUUFBUSxJQUFJLFdBQVcsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUV4RCxNQUFNLE1BQU0sR0FJUjtJQUNGLE9BQU87SUFDUCxJQUFJO0lBQ0osVUFBVSxFQUFFLGlCQUFpQjtDQUM5QixDQUFDO0FBRUYsZUFBZSxNQUFNLENBQUMifQ==
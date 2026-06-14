"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const symbols = {
    kSocketId: Symbol('socket id'),
    kSocketStartTime: Symbol('socket start time'),
    kSocketConnectedTime: Symbol('socket connected time'),
    kSocketConnectErrorTime: Symbol('socket connectError time'),
    kSocketRequestEndTime: Symbol('socket request end time'),
    kSocketLocalAddress: Symbol('socket local address'),
    kSocketLocalPort: Symbol('socket local port'),
    kSocketConnectHost: Symbol('socket connect params: host'),
    kSocketConnectPort: Symbol('socket connect params: port'),
    kSocketConnectProtocol: Symbol('socket connect params: protocol'),
    kHandledRequests: Symbol('handled requests per socket'),
    kHandledResponses: Symbol('handled responses per socket'),
    kRequestSocket: Symbol('request on the socket'),
    kRequestId: Symbol('request id'),
    kRequestStartTime: Symbol('request start time'),
    kEnableRequestTiming: Symbol('enable request timing or not'),
    kRequestTiming: Symbol('request timing'),
    kRequestOriginalOpaque: Symbol('request original opaque'),
    kRequestInternalOpaque: Symbol('request internal opaque'),
    kErrorSocket: Symbol('socket of error'),
};
exports.default = symbols;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zeW1ib2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsTUFBTSxPQUFPLEdBcUJUO0lBQ0YsU0FBUyxFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUM7SUFDOUIsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLG1CQUFtQixDQUFDO0lBQzdDLG9CQUFvQixFQUFFLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQztJQUNyRCx1QkFBdUIsRUFBRSxNQUFNLENBQUMsMEJBQTBCLENBQUM7SUFDM0QscUJBQXFCLEVBQUUsTUFBTSxDQUFDLHlCQUF5QixDQUFDO0lBQ3hELG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQztJQUNuRCxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsbUJBQW1CLENBQUM7SUFDN0Msa0JBQWtCLEVBQUUsTUFBTSxDQUFDLDZCQUE2QixDQUFDO0lBQ3pELGtCQUFrQixFQUFFLE1BQU0sQ0FBQyw2QkFBNkIsQ0FBQztJQUN6RCxzQkFBc0IsRUFBRSxNQUFNLENBQUMsaUNBQWlDLENBQUM7SUFDakUsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLDZCQUE2QixDQUFDO0lBQ3ZELGlCQUFpQixFQUFFLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQztJQUN6RCxjQUFjLEVBQUUsTUFBTSxDQUFDLHVCQUF1QixDQUFDO0lBQy9DLFVBQVUsRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDO0lBQ2hDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQztJQUMvQyxvQkFBb0IsRUFBRSxNQUFNLENBQUMsOEJBQThCLENBQUM7SUFDNUQsY0FBYyxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztJQUN4QyxzQkFBc0IsRUFBRSxNQUFNLENBQUMseUJBQXlCLENBQUM7SUFDekQsc0JBQXNCLEVBQUUsTUFBTSxDQUFDLHlCQUF5QixDQUFDO0lBQ3pELFlBQVksRUFBRSxNQUFNLENBQUMsaUJBQWlCLENBQUM7Q0FDeEMsQ0FBQztBQUVGLGtCQUFlLE9BQU8sQ0FBQyJ9
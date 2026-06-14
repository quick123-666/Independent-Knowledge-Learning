import dns from 'node:dns';
import { isIP } from 'node:net';
import { BaseAgent } from './BaseAgent.js';
class IllegalAddressError extends Error {
    hostname;
    ip;
    family;
    constructor(hostname, ip, family) {
        const message = 'illegal address';
        super(message);
        this.name = this.constructor.name;
        this.hostname = hostname;
        this.ip = ip;
        this.family = family;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class HttpAgent extends BaseAgent {
    #checkAddress;
    constructor(options) {
        /* eslint node/prefer-promises/dns: off*/
        const { lookup = dns.lookup, ...baseOpts } = options;
        const lookupFunction = (hostname, dnsOptions, callback) => {
            lookup(hostname, dnsOptions, (err, ...args) => {
                // address will be array on Node.js >= 20
                const address = args[0];
                const family = args[1];
                if (err)
                    return callback(err, address, family);
                if (options.checkAddress) {
                    // dnsOptions.all set to default on Node.js >= 20, dns.lookup will return address array object
                    if (typeof address === 'string') {
                        if (!options.checkAddress(address, family, hostname)) {
                            err = new IllegalAddressError(hostname, address, family);
                        }
                    }
                    else if (Array.isArray(address)) {
                        const addresses = address;
                        for (const addr of addresses) {
                            if (!options.checkAddress(addr.address, addr.family, hostname)) {
                                err = new IllegalAddressError(hostname, addr.address, addr.family);
                                break;
                            }
                        }
                    }
                }
                callback(err, address, family);
            });
        };
        super({
            ...baseOpts,
            connect: { ...options.connect, lookup: lookupFunction, allowH2: options.allowH2 },
        });
        this.#checkAddress = options.checkAddress;
    }
    dispatch(options, handler) {
        if (this.#checkAddress && options.origin) {
            const originUrl = typeof options.origin === 'string' ? new URL(options.origin) : options.origin;
            let hostname = originUrl.hostname;
            // [2001:db8:2de::e13] => 2001:db8:2de::e13
            if (hostname.startsWith('[') && hostname.endsWith(']')) {
                hostname = hostname.substring(1, hostname.length - 1);
            }
            const family = isIP(hostname);
            if (family === 4 || family === 6) {
                // if request hostname is ip, custom lookup won't execute
                if (!this.#checkAddress(hostname, family, hostname)) {
                    throw new IllegalAddressError(hostname, hostname, family);
                }
            }
        }
        return super.dispatch(options, handler);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSHR0cEFnZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0h0dHBBZ2VudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEdBQUcsTUFBTSxVQUFVLENBQUM7QUFDM0IsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUtoQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFZM0MsTUFBTSxtQkFBb0IsU0FBUSxLQUFLO0lBQ3JDLFFBQVEsQ0FBUztJQUNqQixFQUFFLENBQVM7SUFDWCxNQUFNLENBQVM7SUFFZixZQUFZLFFBQWdCLEVBQUUsRUFBVSxFQUFFLE1BQWM7UUFDdEQsTUFBTSxPQUFPLEdBQUcsaUJBQWlCLENBQUM7UUFDbEMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztRQUNsQyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ2xELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxTQUFVLFNBQVEsU0FBUztJQUN0QyxhQUFhLENBQXdCO0lBRXJDLFlBQVksT0FBeUI7UUFDbkMseUNBQXlDO1FBQ3pDLE1BQU0sRUFBRSxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLFFBQVEsRUFBRSxHQUFHLE9BQU8sQ0FBQztRQUVyRCxNQUFNLGNBQWMsR0FBbUIsQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUFFO1lBQ3hFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLENBQUMsR0FB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
import type { IncomingHttpHeaders as HTTPIncomingHttpHeaders } from 'node:http';
import type { Except } from 'type-fest';
export interface IncomingHttpHeaders extends Except<HTTPIncomingHttpHeaders, 'set-cookie'> {
    'set-cookie'?: string | string[];
}

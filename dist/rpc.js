import { RPCError } from './error';
import { Reorder } from './reorder';
import { defaultRecievable, isRPCMessage, } from './types';
function objToError(obj) {
    return new RPCError(obj.code, obj.message, obj.path);
}
/**
 * Magic ID used for the "ready" call.
 */
const magicReadyCallId = -1;
/**
 * Primitive postMessage based RPC.
 */
export class RPC extends EventTarget {
    /**
     * Creates a new RPC instance. Note: you should use the `rpc` singleton,
     * rather than creating this class directly, in your controls.
     */
    constructor(options) {
        super();
        this.options = options;
        /**
         * A map of IDs to callbacks we'll fire whenever the remote frame responds.
         */
        this.calls = Object.create(null);
        /**
         * Counter to track the sequence number of our calls for reordering.
         * Incremented each time we send a message.
         */
        this.callCounter = 0;
        /**
         * Reorder utility for incoming messages.
         */
        this.reorder = new Reorder();
        /**
         * The name of all methods on this side that have been exposed to the other side.
         */
        this.exposedMethods = new Set();
        this.listener = (ev) => {
            // If we got data that wasn't a string or could not be parsed, or was
            // from a different remote, it's not for us.
            if (this.options.origin && this.options.origin !== '*' && ev.origin !== this.options.origin) {
                return;
            }
            let packet;
            try {
                packet = JSON.parse(ev.data);
            }
            catch (e) {
                return;
            }
            if (!isRPCMessage(packet) || packet.serviceID !== this.options.serviceId) {
                return;
            }
            // postMessage does not guarantee message order, reorder messages as needed.
            // Reset the call counter when we get a "ready" so that the other end sees
            // calls starting from 0.
            if (this.isReadySignal(packet)) {
                const params = packet.type === 'method' ? packet.params : packet.result;
                if (params && params.protocolVersion) {
                    this.remoteProtocolVersion = params.protocolVersion;
                }
                else {
                    this.remoteProtocolVersion = this.remoteProtocolVersion;
                }
                this.callCounter = 0;
                this.reorder.reset(packet.counter);
                const isReadyEvent = new CustomEvent('isReady', {
                    detail: true,
                });
                this.dispatchEvent(isReadyEvent);
            }
            for (const p of this.reorder.append(packet)) {
                const recvDataEvent = new CustomEvent('recvData', {
                    detail: p,
                });
                this.dispatchEvent(recvDataEvent);
                this.dispatchIncoming(p);
            }
        };
        this.unsubscribeCallback = (options.receiver || defaultRecievable).readMessages(this.listener);
        // Both sides will fire "ready" when they're set up. When either we get
        // a ready or the other side successfully responds that they're ready,
        // resolve the "ready" promise.
        this.isReady = new Promise(resolve => {
            const response = { protocolVersion: options.protocolVersion || '1.0' };
            this.expose('ready', () => {
                resolve();
                return response;
            });
            this.call('ready', response)
                .then(resolve)
                .catch(resolve);
        });
    }
    /**
     * Create instantiates a new RPC instance and waits until it's ready
     * before returning.
     */
    create(options) {
        const rpc = new RPC(options);
        return rpc.isReady.then(() => rpc);
    }
    /**
     * Attaches a method callable by the other window, to this one. The handler
     * function will be invoked with whatever the other window gives us. Can
     * return a Promise, or the results directly.
     *
     * @param {string} method
     * @param {function(params: any): Promise.<*>|*} handler
     */
    expose(method, handler) {
        this.exposedMethods.add(method);
        this.on(method, (event) => {
            const data = event.detail;
            if (data.discard) {
                handler(data.params);
                return;
            }
            // tslint:disable-next-line
            new Promise(resolve => resolve(handler(data.params)))
                .then(result => ({
                type: 'reply',
                serviceID: this.options.serviceId,
                id: data.id,
                result,
            }))
                .catch((err) => ({
                type: 'reply',
                serviceID: this.options.serviceId,
                id: data.id,
                error: err instanceof RPCError
                    ? err.toReplyError()
                    : { code: 0, message: err.stack || err.message },
            }))
                .then(packet => {
                const sendReplyEvent = new CustomEvent('sendReply', {
                    detail: packet,
                });
                this.dispatchEvent(sendReplyEvent);
                this.post(packet);
            });
        });
        return this;
    }
    /**
     * Shorthand for `addEventListener()` that only deals with to CustomEvents.
     */
    on(type, callback, options) {
        const cb = (_event) => {
            if (!('detail' in _event)) {
                // Skip invalid event call
                return;
            }
            const event = _event;
            callback(event);
        };
        this.addEventListener(type, cb, options);
    }
    /**
     * Makes an RPC call out to the target window.
     *
     * @param {string} method
     * @param {*} params
     * @param {boolean} [waitForReply=true]
     * @return {Promise.<object> | undefined} If waitForReply is true, a
     * promise is returned that resolves once the server responds.
     */
    call(method, params, waitForReply = true) {
        const id = method === 'ready' ? magicReadyCallId : this.callCounter;
        const packet = {
            type: 'method',
            serviceID: this.options.serviceId,
            id,
            params,
            method,
            discard: !waitForReply,
        };
        const sendMethodEvent = new CustomEvent('sendMethod', {
            detail: packet,
        });
        this.dispatchEvent(sendMethodEvent);
        this.post(packet);
        if (!waitForReply) {
            return;
        }
        return new Promise((resolve, reject) => {
            this.calls[id] = (err, res) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(res);
                }
            };
        });
    }
    /**
     * Tears down resources associated with the RPC client.
     */
    destroy() {
        this.dispatchEvent(new CustomEvent('destroy'));
        this.unsubscribeCallback();
    }
    /**
     * Returns the protocol version that the remote client implements. This
     * will return `undefined` until we get a `ready` event.
     * @return {string | undefined}
     */
    remoteVersion() {
        return this.remoteProtocolVersion;
    }
    handleReply(packet) {
        const handler = this.calls[packet.id];
        if (!handler) {
            return;
        }
        if (packet.error) {
            handler(objToError(packet.error), null);
        }
        else {
            handler(null, packet.result);
        }
        delete this.calls[packet.id];
    }
    post(message) {
        message.counter = this.callCounter++;
        this.options.target.postMessage(JSON.stringify(message), this.options.origin || '*');
    }
    isReadySignal(packet) {
        if (packet.type === 'method' && packet.method === 'ready') {
            return true;
        }
        if (packet.type === 'reply' && packet.id === magicReadyCallId) {
            return true;
        }
        return false;
    }
    dispatchIncoming(packet) {
        switch (packet.type) {
            case 'method': {
                const recvMethodEvent = new CustomEvent('recvMethod', {
                    detail: packet,
                });
                this.dispatchEvent(recvMethodEvent);
                if (this.exposedMethods.has(packet.method)) {
                    const methodEvent = new CustomEvent(packet.method, {
                        detail: packet,
                    });
                    this.dispatchEvent(methodEvent);
                    return;
                }
                this.post({
                    type: 'reply',
                    serviceID: this.options.serviceId,
                    id: packet.id,
                    error: { code: 4003, message: `Unknown method name "${packet.method}"` },
                    result: null,
                });
                break;
            }
            case 'reply': {
                const recvReplyEvent = new CustomEvent('recvReply', {
                    detail: packet,
                });
                this.dispatchEvent(recvReplyEvent);
                this.handleReply(packet);
                break;
            }
            default:
            // Ignore
        }
    }
}

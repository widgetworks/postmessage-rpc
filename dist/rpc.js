var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { EventEmitter } from 'eventemitter3';
import { RPCError } from './error';
import { Reorder } from './reorder';
import { defaultRecievable, isRPCMessage, } from './types';
function objToError(obj) {
    return new RPCError(obj.code, obj.message, obj.path);
}
/**
 * Magic ID used for the "ready" call.
 */
var magicReadyCallId = -1;
/**
 * Primitive postMessage based RPC.
 */
var RPC = /** @class */ (function (_super) {
    __extends(RPC, _super);
    /**
     * Creates a new RPC instance. Note: you should use the `rpc` singleton,
     * rather than creating this class directly, in your controls.
     */
    function RPC(options) {
        var _this = _super.call(this) || this;
        _this.options = options;
        /**
         * A map of IDs to callbacks we'll fire whenever the remote frame responds.
         */
        _this.calls = Object.create(null);
        /**
         * Counter to track the sequence number of our calls for reordering.
         * Incremented each time we send a message.
         */
        _this.callCounter = 0;
        /**
         * Reorder utility for incoming messages.
         */
        _this.reorder = new Reorder();
        _this.listener = function (ev) {
            // If we got data that wasn't a string or could not be parsed, or was
            // from a different remote, it's not for us.
            if (_this.options.origin && _this.options.origin !== '*' && ev.origin !== _this.options.origin) {
                return;
            }
            var packet;
            try {
                packet = JSON.parse(ev.data);
            }
            catch (e) {
                return;
            }
            if (!isRPCMessage(packet) || packet.serviceID !== _this.options.serviceId) {
                return;
            }
            // postMessage does not guarantee message order, reorder messages as needed.
            // Reset the call counter when we get a "ready" so that the other end sees
            // calls starting from 0.
            if (_this.isReadySignal(packet)) {
                var params = packet.type === 'method' ? packet.params : packet.result;
                if (params && params.protocolVersion) {
                    _this.remoteProtocolVersion = params.protocolVersion;
                }
                else {
                    _this.remoteProtocolVersion = _this.remoteProtocolVersion;
                }
                _this.callCounter = 0;
                _this.reorder.reset(packet.counter);
                _this.emit('isReady', true);
            }
            for (var _i = 0, _a = _this.reorder.append(packet); _i < _a.length; _i++) {
                var p = _a[_i];
                _this.emit('recvData', p);
                _this.dispatchIncoming(p);
            }
        };
        _this.unsubscribeCallback = (options.receiver || defaultRecievable).readMessages(_this.listener);
        // Both sides will fire "ready" when they're set up. When either we get
        // a ready or the other side successfully responds that they're ready,
        // resolve the "ready" promise.
        _this.isReady = new Promise(function (resolve) {
            var response = { protocolVersion: options.protocolVersion || '1.0' };
            _this.expose('ready', function () {
                resolve();
                return response;
            });
            _this.call('ready', response)
                .then(resolve)
                .catch(resolve);
        });
        return _this;
    }
    /**
     * Create instantiates a new RPC instance and waits until it's ready
     * before returning.
     */
    RPC.prototype.create = function (options) {
        var rpc = new RPC(options);
        return rpc.isReady.then(function () { return rpc; });
    };
    /**
     * Attaches a method callable by the other window, to this one. The handler
     * function will be invoked with whatever the other window gives us. Can
     * return a Promise, or the results directly.
     *
     * @param {string} method
     * @param {function(params: any): Promise.<*>|*} handler
     */
    RPC.prototype.expose = function (method, handler) {
        var _this = this;
        this.on(method, function (data) {
            if (data.discard) {
                handler(data.params);
                return;
            }
            // tslint:disable-next-line
            new Promise(function (resolve) { return resolve(handler(data.params)); })
                .then(function (result) {
                return ({
                    type: 'reply',
                    serviceID: _this.options.serviceId,
                    id: data.id,
                    result: result,
                });
            })
                .catch(function (err) {
                return ({
                    type: 'reply',
                    serviceID: _this.options.serviceId,
                    id: data.id,
                    error: err instanceof RPCError
                        ? err.toReplyError()
                        : { code: 0, message: err.stack || err.message },
                });
            })
                .then(function (packet) {
                _this.emit('sendReply', packet);
                _this.post(packet);
            });
        });
        return this;
    };
    /**
     * Makes an RPC call out to the target window.
     *
     * @param {string} method
     * @param {*} params
     * @param {boolean} [waitForReply=true]
     * @return {Promise.<object> | undefined} If waitForReply is true, a
     * promise is returned that resolves once the server responds.
     */
    RPC.prototype.call = function (method, params, waitForReply) {
        var _this = this;
        if (waitForReply === void 0) { waitForReply = true; }
        var id = method === 'ready' ? magicReadyCallId : this.callCounter;
        var packet = {
            type: 'method',
            serviceID: this.options.serviceId,
            id: id,
            params: params,
            method: method,
            discard: !waitForReply,
        };
        this.emit('sendMethod', packet);
        this.post(packet);
        if (!waitForReply) {
            return;
        }
        return new Promise(function (resolve, reject) {
            _this.calls[id] = function (err, res) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(res);
                }
            };
        });
    };
    /**
     * Tears down resources associated with the RPC client.
     */
    RPC.prototype.destroy = function () {
        this.emit('destroy');
        this.unsubscribeCallback();
    };
    /**
     * Returns the protocol version that the remote client implements. This
     * will return `undefined` until we get a `ready` event.
     * @return {string | undefined}
     */
    RPC.prototype.remoteVersion = function () {
        return this.remoteProtocolVersion;
    };
    RPC.prototype.handleReply = function (packet) {
        var handler = this.calls[packet.id];
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
    };
    RPC.prototype.post = function (message) {
        message.counter = this.callCounter++;
        this.options.target.postMessage(JSON.stringify(message), this.options.origin || '*');
    };
    RPC.prototype.isReadySignal = function (packet) {
        if (packet.type === 'method' && packet.method === 'ready') {
            return true;
        }
        if (packet.type === 'reply' && packet.id === magicReadyCallId) {
            return true;
        }
        return false;
    };
    RPC.prototype.dispatchIncoming = function (packet) {
        switch (packet.type) {
            case 'method':
                this.emit('recvMethod', packet);
                if (this.listeners(packet.method).length > 0) {
                    this.emit(packet.method, packet);
                    return;
                }
                this.post({
                    type: 'reply',
                    serviceID: this.options.serviceId,
                    id: packet.id,
                    error: { code: 4003, message: "Unknown method name \"" + packet.method + "\"" },
                    result: null,
                });
                break;
            case 'reply':
                this.emit('recvReply', packet);
                this.handleReply(packet);
                break;
            default:
            // Ignore
        }
    };
    return RPC;
}(EventEmitter));
export { RPC };

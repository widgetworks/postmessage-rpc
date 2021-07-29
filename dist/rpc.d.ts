import { EventEmitter } from 'eventemitter3';
import { IPostable, IReceivable } from './types';
/**
 * IRPCOptions are used to construct an RPc instance.
 */
export interface IRPCOptions {
    /**
     * Target window to send messages to, like an iframe.
     */
    target: IPostable;
    /**
     * Unique string that identifies this RPC service. This is used so that
     * multiple RPC instances can communicate on the page without interference.
     * This should be the same on both the sending and receiving end.
     */
    serviceId: string;
    /**
     * Remote origin that we'll communicate with. It may be set to and
     * defaults to '*'.
     */
    origin?: string;
    /**
     * Protocol version that socket will advertise. Defaults to 1.0. You can
     * rev this for compatibility changes between consumers.
     */
    protocolVersion?: string;
    /**
     * Window to read messages from. Defaults to the current window.
     */
    receiver?: IReceivable;
}
/**
 * Primitive postMessage based RPC.
 */
export declare class RPC extends EventEmitter {
    private readonly options;
    /**
     * Promise that resolves once the RPC connection is established.
     */
    readonly isReady: Promise<void>;
    /**
     * A map of IDs to callbacks we'll fire whenever the remote frame responds.
     */
    private calls;
    /**
     * Counter to track the sequence number of our calls for reordering.
     * Incremented each time we send a message.
     */
    private callCounter;
    /**
     * Reorder utility for incoming messages.
     */
    private reorder;
    /**
     * Protocol version the remote frame advertised.
     */
    private remoteProtocolVersion;
    /**
     * Callback invoked when we destroy this RPC instance.
     */
    private unsubscribeCallback;
    /**
     * Creates a new RPC instance. Note: you should use the `rpc` singleton,
     * rather than creating this class directly, in your controls.
     */
    constructor(options: IRPCOptions);
    /**
     * Create instantiates a new RPC instance and waits until it's ready
     * before returning.
     */
    create(options: IRPCOptions): Promise<RPC>;
    /**
     * Attaches a method callable by the other window, to this one. The handler
     * function will be invoked with whatever the other window gives us. Can
     * return a Promise, or the results directly.
     *
     * @param {string} method
     * @param {function(params: any): Promise.<*>|*} handler
     */
    expose<T>(method: string, handler: (params: T) => Promise<any> | any): this;
    call<T>(method: string, params: object, waitForReply?: true): Promise<T>;
    call(method: string, params: object, waitForReply: false): void;
    /**
     * Tears down resources associated with the RPC client.
     */
    destroy(): void;
    /**
     * Returns the protocol version that the remote client implements. This
     * will return `undefined` until we get a `ready` event.
     * @return {string | undefined}
     */
    remoteVersion(): string | undefined;
    private handleReply;
    private post;
    private isReadySignal;
    private listener;
    private dispatchIncoming;
}

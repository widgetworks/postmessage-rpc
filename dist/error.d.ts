/**
 * An RPCError can be thrown in socket.call() if bad input is
 * passed to the service.
 */
export declare class RPCError extends Error {
    readonly code: number;
    readonly message: string;
    readonly path?: string[] | undefined;
    constructor(code: number, message: string, path?: string[] | undefined);
    toReplyError(): {
        code: number;
        message: string;
        path: string[] | undefined;
    };
}

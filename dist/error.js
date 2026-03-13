/**
 * An RPCError can be thrown in socket.call() if bad input is
 * passed to the service.
 */
export class RPCError extends Error {
    constructor(code, message, path) {
        super(`Error #${code}: ${message}`);
        this.code = code;
        this.message = message;
        this.path = path;
        // Patch for ES5 compilation target errors:
        Object.setPrototypeOf(this, RPCError.prototype);
    }
    toReplyError() {
        return {
            code: this.code,
            message: this.message,
            path: this.path,
        };
    }
}

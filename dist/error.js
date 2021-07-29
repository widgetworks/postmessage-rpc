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
/**
 * An RPCError can be thrown in socket.call() if bad input is
 * passed to the service.
 */
var RPCError = /** @class */ (function (_super) {
    __extends(RPCError, _super);
    function RPCError(code, message, path) {
        var _this = _super.call(this, "Error #" + code + ": " + message) || this;
        _this.code = code;
        _this.message = message;
        _this.path = path;
        // Patch for ES5 compilation target errors:
        Object.setPrototypeOf(_this, RPCError.prototype);
        return _this;
    }
    RPCError.prototype.toReplyError = function () {
        return {
            code: this.code,
            message: this.message,
            path: this.path,
        };
    };
    return RPCError;
}(Error));
export { RPCError };

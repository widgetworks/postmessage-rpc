/**
 * Checks whether the message duck-types into an Interactive message.
 * This is needed to distinguish between postmessages that we get,
 * and postmessages from other sources.
 */
export function isRPCMessage(data) {
    return (data.type === 'method' || data.type === 'reply') && typeof data.counter === 'number';
}
/**
 * Default `IRecievable` implementation that listens on the window.
 */
export var defaultRecievable = {
    readMessages: function (callback) {
        window.addEventListener('message', callback);
        return function () { return window.removeEventListener('message', callback); };
    },
};

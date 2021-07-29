/**
 * Reorder is a utility responsible for reording incoming messages.
 */
var Reorder = /** @class */ (function () {
    function Reorder() {
        /**
         * Last call we got which was in sequence..
         */
        this.lastSequentialCall = -1;
        /**
         * Queue of messages to send out once reordered data comes back.
         */
        this.queue = [];
    }
    /**
     * Resets the queue and call counter to the given value.
     */
    Reorder.prototype.reset = function (counter) {
        this.lastSequentialCall = counter - 1;
        this.queue = [];
    };
    /**
     * Appends a message to the reorder queue. Returns all messages which
     * are good to send out.
     */
    Reorder.prototype.append = function (packet) {
        if (packet.counter <= this.lastSequentialCall + 1) {
            var list = [packet];
            this.lastSequentialCall = packet.counter;
            this.replayQueue(list);
            return list;
        }
        for (var i = 0; i < this.queue.length; i++) {
            if (this.queue[i].counter > packet.counter) {
                this.queue.splice(i, 0, packet);
                return [];
            }
        }
        this.queue.push(packet);
        return [];
    };
    Reorder.prototype.replayQueue = function (list) {
        while (this.queue.length) {
            var next = this.queue[0];
            if (next.counter > this.lastSequentialCall + 1) {
                return;
            }
            list.push(this.queue.shift());
            this.lastSequentialCall = next.counter;
        }
    };
    return Reorder;
}());
export { Reorder };

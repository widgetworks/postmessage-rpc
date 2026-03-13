/**
 * Reorder is a utility responsible for reording incoming messages.
 */
export class Reorder {
    constructor() {
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
    reset(counter) {
        this.lastSequentialCall = counter - 1;
        this.queue = [];
    }
    /**
     * Appends a message to the reorder queue. Returns all messages which
     * are good to send out.
     */
    append(packet) {
        if (packet.counter <= this.lastSequentialCall + 1) {
            const list = [packet];
            this.lastSequentialCall = packet.counter;
            this.replayQueue(list);
            return list;
        }
        for (let i = 0; i < this.queue.length; i++) {
            if (this.queue[i].counter > packet.counter) {
                this.queue.splice(i, 0, packet);
                return [];
            }
        }
        this.queue.push(packet);
        return [];
    }
    replayQueue(list) {
        while (this.queue.length) {
            const next = this.queue[0];
            if (next.counter > this.lastSequentialCall + 1) {
                return;
            }
            list.push(this.queue.shift());
            this.lastSequentialCall = next.counter;
        }
    }
}

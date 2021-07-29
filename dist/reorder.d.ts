import { RPCMessageWithCounter } from './types';
/**
 * Reorder is a utility responsible for reording incoming messages.
 */
export declare class Reorder {
    /**
     * Last call we got which was in sequence..
     */
    private lastSequentialCall;
    /**
     * Queue of messages to send out once reordered data comes back.
     */
    private queue;
    /**
     * Resets the queue and call counter to the given value.
     */
    reset(counter: number): void;
    /**
     * Appends a message to the reorder queue. Returns all messages which
     * are good to send out.
     */
    append(packet: RPCMessageWithCounter<any>): Array<RPCMessageWithCounter<any>>;
    private replayQueue;
}

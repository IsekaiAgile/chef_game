/**
 * EventBus - Pub/Sub pattern for decoupled module communication
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles event subscription and publishing
 * - Open/Closed: New event types can be added without modifying this class
 * - Interface Segregation: Subscribers only receive events they subscribe to
 *
 * Memory Management:
 * - Always store and call the unsubscribe function returned by on() when done
 * - Use once() for one-time handlers to automatically clean up
 * - Call clear() on scene transitions or game restart to prevent leaks
 *
 * @example
 * // Subscribe and store unsubscribe function
 * const unsubscribe = eventBus.on('game:state:changed', handler);
 *
 * // Later, clean up when component is destroyed
 * unsubscribe();
 *
 * // Or for class-based cleanup
 * class MyClass {
 *   constructor(eventBus) {
 *     this._unsubscribers = [];
 *     this._unsubscribers.push(eventBus.on('event1', this.handler1.bind(this)));
 *     this._unsubscribers.push(eventBus.on('event2', this.handler2.bind(this)));
 *   }
 *
 *   destroy() {
 *     this._unsubscribers.forEach(unsub => unsub());
 *     this._unsubscribers = [];
 *   }
 * }
 */
class EventBus {
    constructor() {
        /** @private @type {Map<string, Set<Function>>} */
        this._listeners = new Map();

        /** @private @type {Map<string, Set<Function>>} */
        this._onceListeners = new Map();

        /** @private - Track listener counts for debugging */
        this._stats = {
            totalSubscriptions: 0,
            totalEmissions: 0,
            peakListeners: 0
        };
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function - ALWAYS store and call this to prevent memory leaks
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

        // Track stats
        this._stats.totalSubscriptions++;
        this._updatePeakListeners();

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event (fires only once)
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    once(event, callback) {
        if (!this._onceListeners.has(event)) {
            this._onceListeners.set(event, new Set());
        }
        this._onceListeners.get(event).add(callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function to remove
     */
    off(event, callback) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).delete(callback);
        }
        if (this._onceListeners.has(event)) {
            this._onceListeners.get(event).delete(callback);
        }
    }

    /**
     * Publish an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        // Regular listeners
        if (this._listeners.has(event)) {
            this._listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: Error in listener for "${event}"`, error);
                }
            });
        }

        // Once listeners
        if (this._onceListeners.has(event)) {
            this._onceListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: Error in once listener for "${event}"`, error);
                }
            });
            this._onceListeners.delete(event);
        }
    }

    /**
     * Remove all listeners for an event (or all events)
     * @param {string} [event] - Event name (optional)
     */
    clear(event) {
        if (event) {
            this._listeners.delete(event);
            this._onceListeners.delete(event);
        } else {
            this._listeners.clear();
            this._onceListeners.clear();
        }
    }

    // ===== Debugging & Monitoring =====

    /**
     * Update peak listener count for memory monitoring
     * @private
     */
    _updatePeakListeners() {
        const current = this.getListenerCount();
        if (current > this._stats.peakListeners) {
            this._stats.peakListeners = current;
        }
    }

    /**
     * Get total number of active listeners across all events
     * @returns {number} Total listener count
     */
    getListenerCount() {
        let count = 0;
        this._listeners.forEach(set => count += set.size);
        this._onceListeners.forEach(set => count += set.size);
        return count;
    }

    /**
     * Get number of listeners for a specific event
     * @param {string} event - Event name
     * @returns {number} Listener count for event
     */
    getEventListenerCount(event) {
        let count = 0;
        if (this._listeners.has(event)) {
            count += this._listeners.get(event).size;
        }
        if (this._onceListeners.has(event)) {
            count += this._onceListeners.get(event).size;
        }
        return count;
    }

    /**
     * Get EventBus statistics for debugging
     * Useful for detecting memory leaks (growing listener counts)
     * @returns {Object} Stats object
     */
    getStats() {
        return {
            ...this._stats,
            currentListeners: this.getListenerCount(),
            eventTypes: this._listeners.size + this._onceListeners.size,
            events: Array.from(this._listeners.keys())
        };
    }

    /**
     * Log current listener state (for debugging)
     */
    debugLog() {
        console.group('EventBus Debug');
        console.log('Stats:', this.getStats());
        console.log('Regular Listeners:');
        this._listeners.forEach((set, event) => {
            console.log(`  ${event}: ${set.size} listener(s)`);
        });
        console.log('Once Listeners:');
        this._onceListeners.forEach((set, event) => {
            console.log(`  ${event}: ${set.size} listener(s)`);
        });
        console.groupEnd();
    }
}

// Event name constants for type safety
const GameEvents = {
    // Game State Events
    GAME_INITIALIZED: 'game:initialized',
    GAME_STATE_CHANGED: 'game:state:changed',
    DAY_ADVANCED: 'game:day:advanced',

    // Action Events
    ACTION_EXECUTED: 'action:executed',
    ACTION_SUCCESS: 'action:success',
    ACTION_FAILURE: 'action:failure',
    PERFECT_CYCLE: 'action:perfect_cycle',

    // Episode Events
    EPISODE_STARTED: 'episode:started',
    EPISODE_COMPLETED: 'episode:completed',
    EPISODE_GOAL_PROGRESS: 'episode:goal:progress',

    // Dialogue Events
    DIALOGUE_STARTED: 'dialogue:started',
    DIALOGUE_ADVANCED: 'dialogue:advanced',
    DIALOGUE_COMPLETED: 'dialogue:completed',
    DIALOGUE_SKIPPED: 'dialogue:skipped',

    // Scene Events
    SCENE_CHANGED: 'scene:changed',
    SCENE_BACKGROUND_CHANGED: 'scene:background:changed',

    // Choice Events
    CHOICE_PRESENTED: 'choice:presented',
    CHOICE_SELECTED: 'choice:selected',

    // UI Events
    UI_UPDATE_REQUESTED: 'ui:update:requested',
    UI_OVERLAY_SHOW: 'ui:overlay:show',
    UI_OVERLAY_HIDE: 'ui:overlay:hide',

    // Character Events
    CHARACTER_SPEAKING: 'character:speaking',
    CHARACTER_SHOWN: 'character:shown',
    CHARACTER_HIDDEN: 'character:hidden',

    // Special Events
    SPECIAL_CUSTOMER_ARRIVED: 'special:customer:arrived',
    REQUIREMENT_CHANGED: 'special:requirement:changed',
    MINA_TIP_SHOWN: 'mina:tip:shown',

    // Game End Events
    GAME_OVER: 'game:over',
    GAME_VICTORY: 'game:victory',

    // Intro Events
    INTRO_COMPLETED: 'intro:completed'
};

// Singleton instance
const eventBus = new EventBus();

// Export for ES6 modules (will work when we update HTML)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventBus, GameEvents, eventBus };
}

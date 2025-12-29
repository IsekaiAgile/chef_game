/**
 * EventBus - Pub/Sub pattern for decoupled module communication
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles event subscription and publishing
 * - Open/Closed: New event types can be added without modifying this class
 * - Interface Segregation: Subscribers only receive events they subscribe to
 */
class EventBus {
    constructor() {
        this._listeners = new Map();
        this._onceListeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

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
    GAME_VICTORY: 'game:victory'
};

// Singleton instance
const eventBus = new EventBus();

// Export for ES6 modules (will work when we update HTML)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventBus, GameEvents, eventBus };
}

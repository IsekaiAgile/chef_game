// Global setup for Vitest tests
// This file runs before all tests

import { beforeEach } from 'vitest';

// Import GameConfig and GameEvents globally for tests
import { GameConfig } from '../js/core/GameConfig.js';
import { GameEvents } from '../js/core/EventBus.js';

// Make them globally available
globalThis.GameConfig = GameConfig;
globalThis.GameEvents = GameEvents;

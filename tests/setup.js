// Setup file for Vitest - loads GameConfig and GameEvents as global variables
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load GameConfig.js - read and execute the code to define GameConfig
const gameConfigPath = join(__dirname, '../js/core/GameConfig.js');
const gameConfigCode = readFileSync(gameConfigPath, 'utf-8');

// Execute the code to define GameConfig
// Use Function constructor to execute in global scope
const gameConfigFunction = new Function(gameConfigCode + '\nif (typeof GameConfig !== "undefined") { return GameConfig; }');
const GameConfig = gameConfigFunction();

if (GameConfig) {
    globalThis.GameConfig = GameConfig;
    global.GameConfig = GameConfig;
} else {
    // Alternative: try to execute directly
    eval(gameConfigCode);
    if (typeof GameConfig !== 'undefined') {
        globalThis.GameConfig = GameConfig;
        global.GameConfig = GameConfig;
    }
}

// Load EventBus.js to get GameEvents
const eventBusPath = join(__dirname, '../js/core/EventBus.js');
const eventBusCode = readFileSync(eventBusPath, 'utf-8');

// Execute the code to define GameEvents
const eventBusFunction = new Function(eventBusCode + '\nif (typeof GameEvents !== "undefined") { return { GameEvents }; }');
const result = eventBusFunction();

if (result && result.GameEvents) {
    globalThis.GameEvents = result.GameEvents;
    global.GameEvents = result.GameEvents;
} else {
    // Alternative: try to execute directly
    eval(eventBusCode);
    if (typeof GameEvents !== 'undefined') {
        globalThis.GameEvents = GameEvents;
        global.GameEvents = GameEvents;
    }
}

// Verify both are available
if (typeof globalThis.GameConfig === 'undefined') {
    throw new Error('GameConfig is not defined after loading');
}
if (typeof globalThis.GameEvents === 'undefined') {
    throw new Error('GameEvents is not defined after loading');
}
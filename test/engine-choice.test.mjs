import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readEngineChoice, writeEngineChoice, ENGINE_KEY } from '../physics/engine-choice.js';
const mem = (init = {}) => ({ d: { ...init }, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); } });
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

test('readEngineChoice_Empty_ReturnsCannon', () => assert.equal(readEngineChoice(mem()), 'cannon'));
test('readEngineChoice_StoredCrashcat_ReturnsCrashcat', () => assert.equal(readEngineChoice(mem({ [ENGINE_KEY]: 'crashcat' })), 'crashcat'));
test('readEngineChoice_Garbage_ReturnsCannon', () => assert.equal(readEngineChoice(mem({ [ENGINE_KEY]: 'banana' })), 'cannon'));
test('readEngineChoice_StorageThrows_ReturnsCannon', () => assert.equal(readEngineChoice(throwing), 'cannon'));
test('readEngineChoice_NoStorage_ReturnsCannon', () => assert.equal(readEngineChoice(undefined), 'cannon'));
test('writeEngineChoice_StorageThrows_DoesNotThrow', () => assert.doesNotThrow(() => writeEngineChoice(throwing, 'crashcat')));
test('writeEngineChoice_ThenRead_RoundTrips', () => { const s = mem(); writeEngineChoice(s, 'crashcat'); assert.equal(readEngineChoice(s), 'crashcat'); });

import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOMS, TILE, VIEW_H, VIEW_W, validateRooms } from '../src/levels.js';

test('kapitola obsahuje osm validních komnat v jednom rozlišení', () => {
  assert.equal(validateRooms(), true);
  assert.equal(ROOMS.length, 8);
  assert.equal(VIEW_W / TILE, 18);
  assert.equal(VIEW_H / TILE, 11);
});

test('všechny identifikátory místností a střepů jsou unikátní', () => {
  const roomIds = ROOMS.map((room) => room.id);
  const shardIds = ROOMS.flatMap((room) => room.shards.map((shard) => shard.id));

  assert.equal(new Set(roomIds).size, roomIds.length);
  assert.equal(new Set(shardIds).size, shardIds.length);
  assert.equal(shardIds.length, 3);
});

test('každá brána má dosažitelný ovládací prvek před sebou', () => {
  for (const room of ROOMS) {
    for (const gate of room.gates) {
      const controls = [...room.plates, ...room.levers].filter((control) => control.gateId === gate.id);
      assert.ok(controls.length > 0, `${room.id}/${gate.id} nemá ovládání`);
      assert.ok(controls.some((control) => control.x < gate.x), `${room.id}/${gate.id} nelze otevřít z přístupové strany`);
    }
  }
});

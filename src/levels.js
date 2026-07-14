export const TILE = 64;
export const VIEW_W = 1152;
export const VIEW_H = 704;

const MOONSTONE = {
  sky: "#08111f",
  far: "#13253a",
  stone: "#26394b",
  stoneTop: "#587189",
  accent: "#31d8c7",
  glow: "#ffd583",
};

const ARCHIVE = {
  sky: "#0d1224",
  far: "#25233d",
  stone: "#3b354e",
  stoneTop: "#79698d",
  accent: "#8ce6d9",
  glow: "#f5bc6b",
};

const BRASS = {
  sky: "#071822",
  far: "#14323b",
  stone: "#30505a",
  stoneTop: "#6c8b8b",
  accent: "#e0a84f",
  glow: "#baf6de",
};

const EMBER = {
  sky: "#160e19",
  far: "#332136",
  stone: "#50364b",
  stoneTop: "#8f6472",
  accent: "#f08b63",
  glow: "#ffe59a",
};

/**
 * The whole chapter is authored on an 18 x 11 tile canvas. A coordinate on a
 * character, hazard or trigger denotes the position of its feet on a surface;
 * a block coordinate denotes its top-left corner.
 */
export const ROOMS = [
  {
    id: "observatory-court",
    name: "Nádvoří observatoře",
    kicker: "I · První krok",
    palette: MOONSTONE,
    spawn: { x: 1.5, y: 9 },
    blocks: [
      { x: 0, y: 9, w: 18, h: 2 },
      { x: 4, y: 8, w: 2, h: 1 },
      { x: 8, y: 7, w: 2, h: 1 },
      { x: 12, y: 8, w: 2, h: 1 },
    ],
    spikes: [],
    blades: [],
    movingPlatforms: [],
    guards: [],
    shards: [],
    plates: [],
    levers: [],
    gates: [],
    checkpoint: { x: 1.5, y: 9 },
    exit: { x: 17.1, y: 9 },
    hint: "Rozběhni se pomocí A/D nebo šipek. Mezerník skočí a vyšplhá na římsu.",
  },
  {
    id: "fractured-archive",
    name: "Rozbitý archiv",
    kicker: "II · Důvěřuj rukám",
    palette: ARCHIVE,
    spawn: { x: 1.4, y: 9 },
    blocks: [
      { x: 0, y: 9, w: 5, h: 2 },
      { x: 7, y: 9, w: 4, h: 2 },
      { x: 13, y: 9, w: 5, h: 2 },
      { x: 3, y: 7, w: 2, h: 1 },
      { x: 8, y: 7, w: 2, h: 1 },
      { x: 13, y: 7, w: 2, h: 1 },
    ],
    spikes: [],
    blades: [],
    movingPlatforms: [],
    guards: [],
    shards: [{ x: 9, y: 6.25, id: "archive-star" }],
    plates: [],
    levers: [],
    gates: [],
    checkpoint: { x: 8, y: 9 },
    exit: { x: 17.1, y: 9 },
    hint: "Římsy se zachytí automaticky. Dolů a skokem se můžeš bezpečně pustit.",
  },
  {
    id: "counterweight-shaft",
    name: "Šachta protizávaží",
    kicker: "III · Rytmus stroje",
    palette: BRASS,
    spawn: { x: 1.4, y: 9 },
    blocks: [
      { x: 0, y: 9, w: 4, h: 2 },
      { x: 4, y: 10, w: 2, h: 1 },
      { x: 6, y: 9, w: 5, h: 2 },
      { x: 11, y: 10, w: 2, h: 1 },
      { x: 13, y: 9, w: 5, h: 2 },
      { x: 8, y: 7, w: 2, h: 2 },
      { x: 14, y: 7, w: 2, h: 1 },
    ],
    spikes: [
      { x: 4, y: 10, w: 2, phase: 0.15 },
      { x: 11, y: 10, w: 2, phase: 0.65 },
    ],
    blades: [],
    movingPlatforms: [
      { x: 4.25, y: 8, w: 1.5, axis: "y", range: 0.7, speed: 0.55, phase: 0 },
      { x: 11.25, y: 8, w: 1.5, axis: "y", range: 0.7, speed: 0.62, phase: 0.5 },
    ],
    guards: [],
    shards: [],
    plates: [],
    levers: [],
    gates: [],
    checkpoint: { x: 6.6, y: 9 },
    exit: { x: 17.1, y: 9 },
    hint: "Plošiny se vždy vrátí. Vyčkej na jejich nejvyšší bod a skok si předem připrav.",
  },
  {
    id: "brass-cistern",
    name: "Mosazná cisterna",
    kicker: "IV · Otevři tok",
    palette: BRASS,
    spawn: { x: 1.4, y: 9 },
    blocks: [
      { x: 0, y: 9, w: 18, h: 2 },
      { x: 4.5, y: 7, w: 2, h: 1 },
      { x: 9.5, y: 7, w: 2, h: 1 },
      { x: 13, y: 8, w: 2, h: 1 },
    ],
    spikes: [],
    blades: [],
    movingPlatforms: [],
    guards: [],
    shards: [],
    plates: [{ x: 3.25, y: 9, gateId: "cistern-inner" }],
    levers: [{ x: 11.25, y: 7, gateId: "cistern-exit" }],
    gates: [
      { id: "cistern-inner", x: 8, y: 5, h: 4 },
      { id: "cistern-exit", x: 15.5, y: 5, h: 4 },
    ],
    checkpoint: { x: 1.4, y: 9 },
    exit: { x: 17.1, y: 9 },
    hint: "Nášlapná deska odemyká první mříž. Páka na ochozu otevře cestu ven.",
  },
  {
    id: "blade-gallery",
    name: "Galerie čepelí",
    kicker: "V · Poslouchej kov",
    palette: EMBER,
    spawn: { x: 1.4, y: 9 },
    blocks: [
      { x: 0, y: 9, w: 18, h: 2 },
      { x: 5.5, y: 8, w: 2, h: 1 },
      { x: 9, y: 7, w: 1.5, h: 1 },
      { x: 14, y: 7, w: 3, h: 1 },
    ],
    spikes: [
      { x: 3.5, y: 9, w: 1.5, phase: 0 },
      { x: 12, y: 9, w: 1.5, phase: 0.55 },
    ],
    blades: [
      { x: 8.25, y: 4.25, length: 3.75, phase: 0.1 },
      { x: 13.75, y: 4, length: 4, phase: 0.6 },
    ],
    movingPlatforms: [],
    guards: [],
    shards: [{ x: 15.5, y: 6.25, id: "gallery-star" }],
    plates: [],
    levers: [],
    gates: [],
    checkpoint: { x: 8.75, y: 9 },
    exit: { x: 17.1, y: 9 },
    hint: "Pasti před úderem zazvoní a zazáří. Shift zapne opatrnou chůzi.",
  },
  {
    id: "guard-quarters",
    name: "Komnaty stráží",
    kicker: "VI · Klid před úderem",
    palette: EMBER,
    spawn: { x: 1.4, y: 9 },
    blocks: [
      { x: 0, y: 9, w: 18, h: 2 },
      { x: 3, y: 7, w: 2, h: 1 },
      { x: 13.5, y: 7, w: 2.5, h: 1 },
    ],
    spikes: [],
    blades: [],
    movingPlatforms: [],
    guards: [{ x: 10.5, y: 9, health: 3, range: 3 }],
    shards: [],
    plates: [],
    levers: [],
    gates: [],
    checkpoint: { x: 1.4, y: 9 },
    exit: { x: 17.1, y: 9 },
    hint: "F/J zaútočí. R/K kryje; kryt těsně před zásahem stráž vyvede z rovnováhy.",
  },
  {
    id: "clock-heart",
    name: "Srdce hodin",
    kicker: "VII · Vše do sebe zapadá",
    palette: BRASS,
    spawn: { x: 1.4, y: 9 },
    blocks: [
      { x: 0, y: 9, w: 5, h: 2 },
      { x: 5, y: 10, w: 2, h: 1 },
      { x: 7, y: 9, w: 5, h: 2 },
      { x: 12, y: 10, w: 2, h: 1 },
      { x: 14, y: 9, w: 4, h: 2 },
      { x: 7.5, y: 8, w: 1, h: 1 },
      { x: 9, y: 7, w: 2, h: 1 },
      { x: 14, y: 7, w: 2, h: 1 },
    ],
    spikes: [
      { x: 5, y: 10, w: 2, phase: 0.2 },
      { x: 12, y: 10, w: 2, phase: 0.7 },
    ],
    blades: [{ x: 11.75, y: 4.1, length: 3.9, phase: 0.35 }],
    movingPlatforms: [
      { x: 5.2, y: 8.1, w: 1.6, axis: "x", range: 0.65, speed: 0.52, phase: 0 },
      { x: 12.2, y: 8, w: 1.6, axis: "y", range: 0.8, speed: 0.58, phase: 0.5 },
    ],
    guards: [],
    shards: [{ x: 15, y: 6.25, id: "clock-star" }],
    plates: [],
    levers: [{ x: 10, y: 7, gateId: "heart-lock" }],
    gates: [{ id: "heart-lock", x: 16.25, y: 5, h: 4 }],
    checkpoint: { x: 7.5, y: 9 },
    exit: { x: 17.35, y: 9 },
    hint: "Páka nad strojem odemkne poslední mříž. Bezpečnější cesta vede spodem.",
  },
  {
    id: "beacon-hall",
    name: "Síň majáku",
    kicker: "VIII · Poslední světlo",
    palette: MOONSTONE,
    spawn: { x: 1.4, y: 9 },
    blocks: [
      { x: 0, y: 9, w: 18, h: 2 },
      { x: 3, y: 7, w: 2, h: 1 },
      { x: 8, y: 7, w: 2, h: 1 },
      { x: 14.5, y: 7, w: 2, h: 1 },
    ],
    spikes: [],
    blades: [],
    movingPlatforms: [],
    guards: [{ x: 11.5, y: 9, health: 5, boss: true, range: 4.5 }],
    shards: [],
    plates: [],
    levers: [],
    gates: [],
    checkpoint: { x: 1.4, y: 9 },
    exit: { x: 17.1, y: 9 },
    hint: "Strážce střídá dva rytmy. Odraz jeho poslední úder a zapal maják.",
  },
];

const COLLECTION_FIELDS = [
  "blocks",
  "spikes",
  "blades",
  "movingPlatforms",
  "guards",
  "shards",
  "plates",
  "levers",
  "gates",
];

const isFiniteNumber = (value) => Number.isFinite(value);

/**
 * Validates both the schema and the geometric invariants relied upon by the
 * game engine. It throws one aggregate error so malformed authored data never
 * degrades into an obscure collision bug later in a run.
 */
export function validateRooms(rooms = ROOMS) {
  const errors = [];
  const roomIds = new Set();
  const shardIds = new Set();
  const maxX = VIEW_W / TILE;
  const maxY = VIEW_H / TILE;

  const fail = (room, message) => {
    errors.push(`${room?.id ?? "<unknown room>"}: ${message}`);
  };

  const checkPoint = (room, label, point, requireFloor = false) => {
    if (!point || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
      fail(room, `${label} must contain finite x and y coordinates`);
      return;
    }
    if (point.x < 0 || point.x > maxX || point.y < 0 || point.y > maxY) {
      fail(room, `${label} (${point.x}, ${point.y}) lies outside ${maxX}x${maxY}`);
    }
    if (requireFloor && point.y !== 9) {
      fail(room, `${label}.y must be the main floor surface y=9`);
    }
  };

  if (!Array.isArray(rooms)) {
    throw new TypeError("validateRooms expected an array");
  }
  if (rooms.length !== 8) {
    errors.push(`<chapter>: expected 8 rooms, received ${rooms.length}`);
  }

  rooms.forEach((room, roomIndex) => {
    if (!room || typeof room !== "object") {
      errors.push(`<room ${roomIndex}>: room must be an object`);
      return;
    }
    if (typeof room.id !== "string" || room.id.length === 0) {
      fail(room, "id must be a non-empty string");
    } else if (roomIds.has(room.id)) {
      fail(room, `duplicate room id ${room.id}`);
    } else {
      roomIds.add(room.id);
    }
    for (const field of ["name", "kicker", "hint"]) {
      if (typeof room[field] !== "string" || room[field].trim().length === 0) {
        fail(room, `${field} must be a non-empty string`);
      }
    }
    if (!room.palette || typeof room.palette !== "object") {
      fail(room, "palette must be an object");
    }
    for (const field of COLLECTION_FIELDS) {
      if (!Array.isArray(room[field])) {
        fail(room, `${field} must be an array`);
      }
    }

    checkPoint(room, "spawn", room.spawn, true);
    checkPoint(room, "checkpoint", room.checkpoint, true);
    checkPoint(room, "exit", room.exit);

    for (const [index, block] of (room.blocks ?? []).entries()) {
      if (
        !block ||
        ![block.x, block.y, block.w, block.h].every(isFiniteNumber) ||
        block.w <= 0 ||
        block.h <= 0
      ) {
        fail(room, `blocks[${index}] must have finite x/y and positive w/h`);
        continue;
      }
      if (block.x < 0 || block.y < 0 || block.x + block.w > maxX || block.y + block.h > maxY) {
        fail(room, `blocks[${index}] exceeds the ${maxX}x${maxY} room bounds`);
      }
    }

    for (const [index, spike] of (room.spikes ?? []).entries()) {
      const width = spike?.w ?? 1;
      if (!spike || !isFiniteNumber(spike.x) || !isFiniteNumber(spike.y) || !isFiniteNumber(width) || width <= 0) {
        fail(room, `spikes[${index}] must have finite x/y and a positive width`);
        continue;
      }
      if (spike.x < 0 || spike.x + width > maxX || spike.y < 0 || spike.y > maxY) {
        fail(room, `spikes[${index}] exceeds the room bounds`);
      }
    }

    for (const [index, blade] of (room.blades ?? []).entries()) {
      const length = blade?.length ?? 1;
      if (!blade || !isFiniteNumber(blade.x) || !isFiniteNumber(blade.y) || !isFiniteNumber(length) || length <= 0) {
        fail(room, `blades[${index}] must have finite x/y and a positive length`);
        continue;
      }
      if (blade.x < 0 || blade.x > maxX || blade.y < 0 || blade.y + length > maxY) {
        fail(room, `blades[${index}] exceeds the room bounds`);
      }
    }

    for (const [index, platform] of (room.movingPlatforms ?? []).entries()) {
      if (
        !platform ||
        ![platform.x, platform.y, platform.w, platform.range, platform.speed].every(isFiniteNumber) ||
        platform.w <= 0 ||
        platform.range < 0 ||
        platform.speed <= 0 ||
        !["x", "y"].includes(platform.axis)
      ) {
        fail(room, `movingPlatforms[${index}] has an invalid position, size, axis, range or speed`);
        continue;
      }
      const left = platform.axis === "x" ? platform.x - platform.range : platform.x;
      const right = platform.axis === "x" ? platform.x + platform.range + platform.w : platform.x + platform.w;
      const top = platform.axis === "y" ? platform.y - platform.range : platform.y;
      const bottom = platform.axis === "y" ? platform.y + platform.range : platform.y;
      if (left < 0 || right > maxX || top < 0 || bottom > maxY) {
        fail(room, `movingPlatforms[${index}] leaves the room at the end of its range`);
      }
    }

    for (const [index, guard] of (room.guards ?? []).entries()) {
      checkPoint(room, `guards[${index}]`, guard);
      if (guard?.health !== undefined && (!isFiniteNumber(guard.health) || guard.health <= 0)) {
        fail(room, `guards[${index}].health must be positive`);
      }
      if (guard?.range !== undefined && (!isFiniteNumber(guard.range) || guard.range <= 0)) {
        fail(room, `guards[${index}].range must be positive`);
      }
    }

    for (const [index, shard] of (room.shards ?? []).entries()) {
      checkPoint(room, `shards[${index}]`, shard);
      if (typeof shard?.id !== "string" || shard.id.length === 0) {
        fail(room, `shards[${index}].id must be a non-empty string`);
      } else if (shardIds.has(shard.id)) {
        fail(room, `duplicate shard id ${shard.id}`);
      } else {
        shardIds.add(shard.id);
      }
    }

    const gateIds = new Set();
    for (const [index, gate] of (room.gates ?? []).entries()) {
      if (
        !gate ||
        typeof gate.id !== "string" ||
        gate.id.length === 0 ||
        ![gate.x, gate.y, gate.h].every(isFiniteNumber) ||
        gate.h <= 0
      ) {
        fail(room, `gates[${index}] is malformed`);
        continue;
      }
      if (gateIds.has(gate.id)) fail(room, `duplicate gate id ${gate.id}`);
      gateIds.add(gate.id);
      if (gate.x < 0 || gate.x > maxX || gate.y < 0 || gate.y + gate.h > maxY) {
        fail(room, `gates[${index}] exceeds the room bounds`);
      }
    }

    for (const field of ["plates", "levers"]) {
      for (const [index, trigger] of (room[field] ?? []).entries()) {
        checkPoint(room, `${field}[${index}]`, trigger);
        if (typeof trigger?.gateId !== "string" || !gateIds.has(trigger.gateId)) {
          fail(room, `${field}[${index}] references missing gate ${trigger?.gateId ?? "<none>"}`);
        }
      }
    }

    // Keep every main-floor pit jumpable. Platforms can make a gap easier, but
    // they are deliberately not counted here so the static layout stays safe.
    const floorSpans = (room.blocks ?? [])
      .filter((block) => block?.y === 9 && isFiniteNumber(block.x) && isFiniteNumber(block.w))
      .map((block) => [block.x, block.x + block.w])
      .sort((a, b) => a[0] - b[0]);
    for (let index = 1; index < floorSpans.length; index += 1) {
      const previousEnd = Math.max(...floorSpans.slice(0, index).map((span) => span[1]));
      const gap = floorSpans[index][0] - previousEnd;
      if (gap > 3) fail(room, `main-floor gap of ${gap} tiles exceeds the 3-tile limit`);
    }

    const hasSupportingSurface = (point) =>
      !!point &&
      (room.blocks ?? []).some(
        (block) =>
          block?.y === point.y &&
          point.x >= block.x &&
          point.x <= block.x + block.w,
      );
    if (room.spawn && !hasSupportingSurface(room.spawn)) fail(room, "spawn has no supporting block surface");
    if (room.checkpoint && !hasSupportingSurface(room.checkpoint)) fail(room, "checkpoint has no supporting block surface");
    if (room.exit && !hasSupportingSurface(room.exit)) fail(room, "exit has no supporting block surface");
  });

  if (errors.length > 0) {
    throw new Error(`Invalid room data:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  return true;
}

validateRooms();

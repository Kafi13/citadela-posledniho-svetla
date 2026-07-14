import { aabb, approach, clamp, damp, formatTime, resolveMotion } from "./core.js";
import { InputManager } from "./input.js";
import { ROOMS, TILE, VIEW_H, VIEW_W, validateRooms } from "./levels.js";
import { CitadelRenderer } from "./renderer.js";

const STEP = 1 / 60;
const GRAVITY = 1850;
const PLAYER_WIDTH = 34;
const PLAYER_HEIGHT = 60;
const VALID_SHARD_IDS = new Set(ROOMS.flatMap((room) => room.shards.map((shard) => shard.id)));

const pxBlock = (block, index) => ({
  ...block,
  id: `block-${index}`,
  x: block.x * TILE,
  y: block.y * TILE,
  w: block.w * TILE,
  h: block.h * TILE,
  kind: block.kind ?? "stone",
  fall: 0,
  disabled: false,
});

function makePlayer(point, maxHealth = 3) {
  return {
    x: point.x * TILE - PLAYER_WIDTH / 2,
    y: point.y * TILE - PLAYER_HEIGHT,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    floor: null,
    hanging: null,
    crouched: false,
    blocking: false,
    combat: false,
    attackTimer: 0,
    attackDuration: 0.42,
    attackSerial: 0,
    jumpBuffer: 0,
    coyote: 0,
    parryWindow: 0,
    invulnerable: 0,
    maxHealth,
    health: maxHealth,
    dead: false,
    deathTimer: 0,
    fallStart: point.y * TILE - PLAYER_HEIGHT,
    stepDistance: 0,
    safeX: point.x * TILE - PLAYER_WIDTH / 2,
    safeY: point.y * TILE - PLAYER_HEIGHT,
    standingPlatform: null,
  };
}

export class CitadelGame {
  constructor(canvas, { audio, settings, onEvent = () => {} } = {}) {
    validateRooms();
    this.canvas = canvas;
    this.audio = audio;
    this.settings = settings;
    this.onEvent = onEvent;
    this.input = new InputManager(document);
    this.input.enabled = false;
    this.renderer = new CitadelRenderer(canvas);
    this.mode = "idle";
    this.roomIndex = 0;
    this.room = ROOMS[0];
    this.world = null;
    this.player = null;
    this.elapsed = 0;
    this.deaths = 0;
    this.collectedShards = new Set();
    this.particles = [];
    this.trapTime = 0;
    this.shake = 0;
    this.flash = 0;
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.lastHudUpdate = -1;
    this.prompt = "";
    this.warningCycles = new Map();
    this.loadRoom(0, { silent: true });
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  startNew() {
    this.elapsed = 0;
    this.deaths = 0;
    this.trapTime = 0;
    this.collectedShards.clear();
    this.setMode("playing");
    this.loadRoom(0);
    this.emit("save", this.snapshot());
    this.canvas.focus({ preventScroll: true });
  }

  continueFrom(save = {}) {
    const roomIndex = Number(save.room);
    this.elapsed = Number.isFinite(Number(save.elapsed)) ? Math.max(0, Number(save.elapsed)) : 0;
    this.deaths = Number.isFinite(Number(save.deaths)) ? Math.max(0, Math.floor(Number(save.deaths))) : 0;
    this.collectedShards = new Set(
      Array.isArray(save.shards) ? save.shards.filter((id) => VALID_SHARD_IDS.has(id)) : [],
    );
    this.setMode("playing");
    this.loadRoom(Number.isInteger(roomIndex) ? clamp(roomIndex, 0, ROOMS.length - 1) : 0, {
      checkpointActive: save.checkpointActive === true,
    });
    this.canvas.focus({ preventScroll: true });
  }

  snapshot() {
    return {
      version: 1,
      room: this.roomIndex,
      elapsed: this.elapsed,
      deaths: this.deaths,
      shards: [...this.collectedShards],
      checkpointActive: Boolean(this.world?.checkpoint.active),
      savedAt: new Date().toISOString(),
    };
  }

  setMode(mode) {
    this.mode = mode;
    this.input.enabled = mode === "playing";
    this.input.pauseOnly = mode === "paused";
    if (mode === "paused") this.input.clearTransient();
    else if (mode !== "playing") this.input.clear();
    if (mode === "playing") this.canvas.focus({ preventScroll: true });
  }

  pause() {
    if (this.mode !== "playing") return;
    this.setMode("paused");
    this.audio?.setCombat(false);
  }

  resume() {
    if (this.mode !== "paused") return;
    this.setMode("playing");
    this.lastFrame = performance.now();
  }

  returnToTitle() {
    this.setMode("idle");
    this.audio?.setCombat(false);
  }

  restartRoom() {
    this.deaths += 1;
    this.setMode("playing");
    this.loadRoom(this.roomIndex);
    this.emit("save", this.snapshot());
  }

  updateSettings(settings) {
    this.settings = settings;
    const targetMax = settings.storyMode ? 5 : 3;
    if (this.player) {
      const healthRatio = this.player.health / this.player.maxHealth;
      this.player.maxHealth = targetMax;
      this.player.health = clamp(Math.ceil(healthRatio * targetMax), 1, targetMax);
      this.emitHud(true);
    }
  }

  frame(timestamp) {
    const rawDelta = Math.min((timestamp - this.lastFrame) / 1000, 0.1);
    this.lastFrame = timestamp;
    this.input.pollGamepad();

    if (this.input.consume("pause")) this.emit("pause-toggle");

    let steps = 0;
    if (this.mode === "playing") {
      this.accumulator += rawDelta;
      while (this.mode === "playing" && this.accumulator >= STEP && steps < 7) {
        this.update(STEP);
        this.accumulator -= STEP;
        steps += 1;
      }
    } else {
      this.accumulator = 0;
      this.updatePresentation(rawDelta);
    }

    if (steps > 0) this.input.clearTransient();
    this.renderer.render(this, timestamp);
    requestAnimationFrame(this.frame);
  }

  update(dt) {
    this.elapsed += dt;
    this.trapTime += dt;
    this.updatePresentation(dt);
    this.updatePlatforms(dt);
    this.updateTraps(dt);
    this.updateSwitches(dt);
    this.updatePlayer(dt);
    this.updateGuards(dt);
    this.updateInteractions();
    this.updateParticles(dt);
    this.emitHud();
    this.input.endStep();
  }

  updatePresentation(dt) {
    this.shake = Math.max(0, this.shake - dt * 3.4);
    this.flash = Math.max(0, this.flash - dt * 2.8);
  }

  loadRoom(index, { silent = false, checkpointActive = false } = {}) {
    const safeIndex = Number.isInteger(index) ? index : 0;
    this.roomIndex = clamp(safeIndex, 0, ROOMS.length - 1);
    this.room = ROOMS[this.roomIndex];
    this.trapTime = 0;
    const room = this.room;
    const maxHealth = this.settings.storyMode ? 5 : 3;
    this.player = makePlayer(room.spawn, maxHealth);

    this.world = {
      blocks: room.blocks.map(pxBlock),
      spikes: room.spikes.map((spike, index) => ({
        ...spike,
        id: `spike-${index}`,
        x: spike.x * TILE,
        y: spike.y * TILE,
        w: (spike.w ?? 1) * TILE,
        extension: 0,
        warning: false,
      })),
      blades: room.blades.map((blade, index) => ({
        ...blade,
        id: `blade-${index}`,
        anchorX: blade.x * TILE,
        anchorY: blade.y * TILE,
        lengthPx: (blade.length ?? 3) * TILE,
        tipX: blade.x * TILE,
        tipY: blade.y * TILE,
        angle: 0,
        warning: false,
      })),
      movingPlatforms: room.movingPlatforms.map((platform, index) => ({
        ...platform,
        id: `platform-${index}`,
        baseX: platform.x * TILE,
        baseY: platform.y * TILE,
        x: platform.x * TILE,
        y: platform.y * TILE,
        prevX: platform.x * TILE,
        prevY: platform.y * TILE,
        w: platform.w * TILE,
        h: 14,
        kind: "moving",
      })),
      guards: room.guards.map((guard, index) => this.makeGuard(guard, index)),
      shards: room.shards.map((shard) => ({
        ...shard,
        x: shard.x * TILE,
        y: shard.y * TILE,
        collected: this.collectedShards.has(shard.id),
      })),
      plates: room.plates.map((plate, index) => ({
        ...plate,
        id: `plate-${index}`,
        x: plate.x * TILE - 25,
        y: plate.y * TILE - 10,
        w: 50,
        h: 10,
        active: false,
      })),
      levers: room.levers.map((lever, index) => ({
        ...lever,
        id: `lever-${index}`,
        x: lever.x * TILE - 16,
        y: lever.y * TILE - 54,
        w: 32,
        h: 54,
        active: false,
      })),
      gates: room.gates.map((gate) => ({
        ...gate,
        x: gate.x * TILE,
        y: gate.y * TILE,
        w: 38,
        h: gate.h * TILE,
        open: 0,
        targetOpen: false,
      })),
      checkpoint: {
        x: room.checkpoint.x * TILE,
        y: room.checkpoint.y * TILE,
        active: false,
      },
      exit: { x: room.exit.x * TILE, y: room.exit.y * TILE },
    };

    this.particles = [];
    this.warningCycles.clear();
    this.prompt = "";
    this.emit("prompt", "");
    this.audio?.setCombat(false);
    const checkpointDistance = Math.abs(room.spawn.x - room.checkpoint.x) + Math.abs(room.spawn.y - room.checkpoint.y);
    if (checkpointDistance < 0.7 || checkpointActive) {
      this.activateCheckpoint(true);
      if (checkpointActive) {
        this.player.x = this.player.safeX;
        this.player.y = this.player.safeY;
      }
    }
    this.emitHud(true);

    if (!silent) {
      this.audio?.cue("room");
      this.emit("room", {
        index: this.roomIndex,
        total: ROOMS.length,
        name: room.name,
        kicker: room.kicker,
        hint: room.hint,
      });
      this.emit("save", this.snapshot());
    }
  }

  makeGuard(definition, index) {
    const healthReduction = this.settings.storyMode ? 1 : 0;
    const health = Math.max(1, (definition.health ?? 3) - healthReduction);
    return {
      ...definition,
      id: `guard-${index}`,
      x: definition.x * TILE - 18,
      y: definition.y * TILE - 60,
      homeX: definition.x * TILE - 18,
      w: 36,
      h: 60,
      vx: 0,
      vy: 0,
      facing: -1,
      health,
      maxHealth: health,
      state: "patrol",
      stateTimer: 0,
      cooldown: 0.7 + index * 0.23,
      stunned: 0,
      invulnerable: 0,
      dead: false,
      lastHitSerial: -1,
      onGround: false,
    };
  }

  getSolids() {
    const blocks = this.world.blocks.filter((block) => !block.disabled && (block.kind !== "crumble" || block.fall < 0.72));
    const gates = this.world.gates
      .filter((gate) => gate.open < 0.9)
      .map((gate) => ({
        ...gate,
        y: gate.y - gate.open * (gate.h + 16),
        kind: "gate",
      }));
    return [...blocks, ...this.world.movingPlatforms, ...gates];
  }

  updatePlatforms() {
    const slow = this.settings.slowTraps ? 0.7 : 1;
    for (const platform of this.world.movingPlatforms) {
      platform.prevX = platform.x;
      platform.prevY = platform.y;
      const wave = Math.sin((this.trapTime * platform.speed * slow + (platform.phase ?? 0)) * Math.PI * 2);
      platform.x = platform.baseX + (platform.axis === "x" ? wave * platform.range * TILE : 0);
      platform.y = platform.baseY + (platform.axis === "y" ? wave * platform.range * TILE : 0);
    }
  }

  updateTraps(dt) {
    const slow = this.settings.slowTraps ? 0.7 : 1;
    const cycleLength = 2.8;

    for (const spike of this.world.spikes) {
      const total = this.trapTime * slow + (spike.phase ?? 0) * cycleLength;
      const cycle = Math.floor(total / cycleLength);
      const phase = total % cycleLength;
      spike.warning = phase >= 0.4 && phase < 1.08;
      if (phase < 0.72) spike.extension = 0;
      else if (phase < 1.08) spike.extension = (phase - 0.72) / 0.36;
      else if (phase < 1.72) spike.extension = 1;
      else if (phase < 2.08) spike.extension = 1 - (phase - 1.72) / 0.36;
      else spike.extension = 0;

      const warningKey = `spike-${spike.id}`;
      if (spike.warning && this.warningCycles.get(warningKey) !== cycle) {
        this.warningCycles.set(warningKey, cycle);
        this.audio?.cue("warning", { pan: this.panFor(spike.x) });
      }
    }

    for (const blade of this.world.blades) {
      const total = this.trapTime * slow * 0.72 + (blade.phase ?? 0);
      blade.angle = Math.sin(total * Math.PI * 2) * 1.05;
      blade.tipX = blade.anchorX + Math.sin(blade.angle) * blade.lengthPx;
      blade.tipY = blade.anchorY + Math.cos(blade.angle) * blade.lengthPx;
      blade.warning = Math.abs(Math.cos(total * Math.PI * 2)) > 0.86;
      const warningHalfCycle = Math.floor(total * 2);
      const warningKey = `blade-${blade.id}`;
      if (blade.warning && this.warningCycles.get(warningKey) !== warningHalfCycle) {
        this.warningCycles.set(warningKey, warningHalfCycle);
        this.audio?.cue("warning", { pitch: 1.15, pan: this.panFor(blade.tipX) });
      }
    }

    for (const block of this.world.blocks) {
      if (block.kind !== "crumble" || block.fall <= 0) continue;
      block.fall += dt;
      if (block.fall > 3.7) block.fall = 0;
    }

    for (const gate of this.world.gates) {
      const previous = gate.open;
      gate.open = approach(gate.open, gate.targetOpen ? 1 : 0, dt * 1.45);
      if (Math.abs(gate.open - previous) > 0.0001 && Math.floor(previous * 5) !== Math.floor(gate.open * 5)) {
        this.audio?.cue("gate", { gain: 0.32, pan: this.panFor(gate.x) });
      }
    }
  }

  updateSwitches() {
    const playerFeet = {
      x: this.player.x + 5,
      y: this.player.y + this.player.h - 8,
      w: this.player.w - 10,
      h: 12,
    };

    for (const plate of this.world.plates) {
      const wasActive = plate.active;
      const guardOnPlate = this.world.guards.some((guard) => !guard.dead && aabb(guard, plate));
      if (aabb(playerFeet, plate) || guardOnPlate) plate.active = true;
      if (plate.active) {
        const gate = this.world.gates.find((candidate) => candidate.id === plate.gateId);
        if (gate) gate.targetOpen = true;
      }
      if (!wasActive && plate.active) {
        this.audio?.cue("switch", { pan: this.panFor(plate.x) });
        this.emit("toast", "Mechanismus zůstane bezpečně zajištěný.");
        this.burst(plate.x + plate.w / 2, plate.y, this.room.palette.glow, 10);
      }
    }
  }

  updatePlayer(dt) {
    const player = this.player;
    if (!player) return;

    if (player.dead) {
      player.deathTimer -= dt;
      player.vy = Math.min(player.vy + GRAVITY * dt, 1100);
      player.y += player.vy * dt;
      if (player.deathTimer <= 0) this.respawnPlayer();
      return;
    }

    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.coyote = player.onGround ? 0.12 : Math.max(0, player.coyote - dt);
    player.parryWindow = Math.max(0, player.parryWindow - dt);

    if (player.hanging) {
      this.updateHangingPlayer(player);
      return;
    }

    if (this.input.consume("jump")) player.jumpBuffer = 0.15;
    if (this.input.consume("attack") && player.attackTimer <= 0 && !player.hanging) {
      player.attackTimer = player.attackDuration;
      player.attackSerial += 1;
      player.blocking = false;
      this.audio?.cue("slash", { pan: this.panFor(player.x) });
    }
    if (this.input.consume("block")) player.parryWindow = 0.2;

    player.blocking = this.input.isDown("block") && !player.hanging && player.attackTimer <= 0;

    const nearbyGuard = this.world.guards.some(
      (guard) => !guard.dead && Math.abs(guard.x - player.x) < 260,
    );
    player.combat = nearbyGuard;
    this.audio?.setCombat(nearbyGuard);

    let direction = this.input.axis();
    const walking = this.input.isDown("walk");
    player.crouched = this.input.isDown("down") && player.onGround && Math.abs(player.vx) < 90;

    if (player.blocking || player.attackTimer > 0.18 || player.crouched) direction = 0;
    if (direction !== 0) player.facing = direction;

    const topSpeed = walking ? 118 : player.combat ? 175 : 285;
    const acceleration = player.onGround ? 1900 : 930;
    player.vx = approach(player.vx, direction * topSpeed, acceleration * dt);
    if (direction === 0) player.vx = approach(player.vx, 0, (player.onGround ? 2350 : 340) * dt);

    if (walking && player.onGround && direction !== 0 && !this.hasFloorAhead(player, direction)) {
      player.vx = 0;
    }

    if (player.jumpBuffer > 0 && player.coyote > 0 && !player.crouched && !player.blocking) {
      player.vy = -660;
      player.onGround = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      player.fallStart = player.y;
      this.audio?.cue("jump", { pan: this.panFor(player.x) });
      this.burst(player.x + player.w / 2, player.y + player.h, `${this.room.palette.stoneTop}aa`, 5);
    }

    if (this.input.wasReleased("jump") && player.vy < -260) player.vy = -260;

    if (player.standingPlatform) {
      const platform = this.world.movingPlatforms.find((candidate) => candidate.id === player.standingPlatform);
      if (platform) {
        const carrySolids = this.getSolids().filter((solid) => solid !== platform);
        const carry = resolveMotion(player, platform.x - platform.prevX, platform.y - platform.prevY, carrySolids);
        player.x = carry.x;
        player.y = carry.y;
        if (carry.hitTop) this.hurtPlayer("crush", 0, true);
      }
      player.standingPlatform = null;
    }

    player.vy = Math.min(player.vy + GRAVITY * dt, 1080);
    const beforeX = player.x;
    const beforeVy = player.vy;
    const motion = resolveMotion(player, player.vx * dt, player.vy * dt, this.getSolids());
    player.x = clamp(motion.x, 0, VIEW_W - player.w);
    player.y = motion.y;

    if (motion.hitLeft || motion.hitRight) player.vx = 0;
    player.onGround = motion.hitBottom;
    player.floor = motion.floor;
    if (motion.hitBottom) {
      const impactSpeed = beforeVy;
      player.vy = 0;
      player.standingPlatform = motion.floor?.kind === "moving" ? motion.floor.id : null;
      if (motion.floor?.kind === "crumble" && motion.floor.fall === 0) motion.floor.fall = 0.001;
      if (impactSpeed > 760) this.hurtPlayer("fall", 0, true);
      else if (impactSpeed > 430) {
        this.audio?.cue("land", { gain: 1.15, pan: this.panFor(player.x) });
        this.shake = Math.max(this.shake, 0.23);
      }
      player.fallStart = player.y;
    } else if (beforeVy <= 0 && player.vy > 0) {
      player.fallStart = player.y;
    }
    if (motion.hitTop) player.vy = Math.max(0, player.vy);

    const moved = Math.abs(player.x - beforeX);
    if (player.onGround && moved > 0.5) {
      player.stepDistance += moved;
      if (player.stepDistance > (walking ? 55 : 78)) {
        player.stepDistance = 0;
        this.audio?.cue("step", { pitch: 0.92 + Math.random() * 0.15, pan: this.panFor(player.x) });
      }
    }

    if (!player.onGround && player.vy > 40) this.tryGrabLedge(player, motion);
    this.checkPlayerHazards(player);
    this.checkCollectibles(player);
    this.checkCheckpoint(player);
    this.applyPlayerAttack(player);

    if (player.y > VIEW_H + 96) {
      this.audio?.cue("fall", { pan: this.panFor(player.x) });
      this.hurtPlayer("abyss", 0, true, true);
    }
  }

  updateHangingPlayer(player) {
    const ledge = player.hanging.solid;
    if (ledge.kind === "moving") {
      player.x += ledge.x - ledge.prevX;
      player.y += ledge.y - ledge.prevY;
    }
    player.vx = 0;
    player.vy = 0;
    player.blocking = false;
    player.crouched = false;

    if (this.input.consume("jump")) {
      const side = player.hanging.side;
      player.x = side > 0 ? ledge.x + 8 : ledge.x + ledge.w - player.w - 8;
      player.y = ledge.y - player.h;
      player.facing = side;
      player.hanging = null;
      player.onGround = true;
      player.coyote = 0.12;
      this.audio?.cue("climb", { pan: this.panFor(player.x) });
      this.burst(player.x + player.w / 2, player.y + player.h, this.room.palette.accent, 7);
    } else if (this.input.isDown("down")) {
      player.hanging = null;
      player.vy = 95;
      player.y += 5;
    }
  }

  tryGrabLedge(player, motion) {
    const wantedDirection = this.input.axis();
    const candidates = this.getSolids().filter((solid) => solid.kind !== "gate");

    for (const solid of candidates) {
      const ledgeOffset = solid.y - player.y;
      if (ledgeOffset < 8 || ledgeOffset > 30) continue;
      const rightDistance = Math.abs(player.x + player.w - solid.x);
      const leftDistance = Math.abs(player.x - (solid.x + solid.w));
      let side = 0;
      if (rightDistance < 7 && (wantedDirection > 0 || this.settings.autoGrab)) side = 1;
      if (leftDistance < 7 && (wantedDirection < 0 || this.settings.autoGrab)) side = -1;
      if (!side) continue;

      const climbX = side > 0 ? solid.x + 9 : solid.x + solid.w - player.w - 9;
      const headRoom = { x: climbX, y: solid.y - player.h, w: player.w, h: player.h - 4 };
      if (candidates.some((other) => other !== solid && aabb(headRoom, other, 1))) continue;

      player.hanging = { side, solid };
      player.facing = side;
      player.x = side > 0 ? solid.x - player.w - 0.5 : solid.x + solid.w + 0.5;
      player.y = solid.y + 8;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      this.audio?.cue("grab", { pan: this.panFor(player.x) });
      this.shake = Math.max(this.shake, 0.08);
      return;
    }

    if ((motion.hitLeft || motion.hitRight) && !this.settings.autoGrab) player.vx = 0;
  }

  hasFloorAhead(player, direction) {
    const probe = {
      x: direction > 0 ? player.x + player.w + 5 : player.x - 11,
      y: player.y + player.h + 1,
      w: 7,
      h: 10,
    };
    return this.getSolids().some((solid) => aabb(probe, solid));
  }

  checkPlayerHazards(player) {
    for (const spike of this.world.spikes) {
      if (spike.extension < 0.58) continue;
      const danger = { x: spike.x + 3, y: spike.y - 33 * spike.extension, w: spike.w - 6, h: 34 * spike.extension };
      if (aabb(player, danger, 4)) this.hurtPlayer("spikes", player.x < spike.x + spike.w / 2 ? -280 : 280);
    }

    for (const blade of this.world.blades) {
      const danger = { x: blade.tipX - 25, y: blade.tipY - 25, w: 50, h: 50 };
      if (aabb(player, danger, 6)) this.hurtPlayer("blade", player.x < blade.tipX ? -330 : 330);
    }
  }

  checkCollectibles(player) {
    for (const shard of this.world.shards) {
      if (shard.collected) continue;
      const pickup = { x: shard.x - 23, y: shard.y - 23, w: 46, h: 46 };
      if (!aabb(player, pickup)) continue;
      shard.collected = true;
      this.collectedShards.add(shard.id);
      this.audio?.cue("shard", { pan: this.panFor(shard.x) });
      this.burst(shard.x, shard.y, this.room.palette.glow, 24);
      this.flash = 0.45;
      this.emit("toast", `Světelný střep nalezen · ${this.collectedShards.size} / 3`);
      this.emit("save", this.snapshot());
      this.emitHud(true);
    }
  }

  checkCheckpoint(player) {
    const checkpoint = this.world.checkpoint;
    if (checkpoint.active) return;
    const distance = Math.hypot(player.x + player.w / 2 - checkpoint.x, player.y + player.h - checkpoint.y);
    if (distance < 52) this.activateCheckpoint(false);
  }

  activateCheckpoint(silent) {
    const checkpoint = this.world.checkpoint;
    checkpoint.active = true;
    this.player.safeX = checkpoint.x - this.player.w / 2;
    this.player.safeY = checkpoint.y - this.player.h;
    this.player.health = this.player.maxHealth;
    if (!silent) {
      this.audio?.cue("checkpoint", { pan: this.panFor(checkpoint.x) });
      this.burst(checkpoint.x, checkpoint.y - 20, this.room.palette.glow, 16);
      this.emit("toast", "Světlo si toto místo zapamatovalo.");
      this.emitHud(true);
      this.emit("save", this.snapshot());
    }
  }

  applyPlayerAttack(player) {
    if (player.attackTimer <= 0) return;
    const progress = 1 - player.attackTimer / player.attackDuration;
    if (progress < 0.25 || progress > 0.62) return;
    const attack = {
      x: player.facing > 0 ? player.x + player.w - 3 : player.x - 61,
      y: player.y + 7,
      w: 64,
      h: 46,
    };

    for (const guard of this.world.guards) {
      if (guard.dead || guard.invulnerable > 0 || guard.lastHitSerial === player.attackSerial || !aabb(attack, guard)) continue;
      guard.lastHitSerial = player.attackSerial;
      guard.health -= 1;
      guard.invulnerable = 0.26;
      guard.stunned = 0.42;
      guard.state = "stunned";
      guard.vx = player.facing * 180;
      this.audio?.cue("hit", { pan: this.panFor(guard.x) });
      this.burst(guard.x + guard.w / 2, guard.y + 25, this.room.palette.glow, 12);
      this.shake = Math.max(this.shake, guard.boss ? 0.38 : 0.2);
      if (guard.health <= 0) {
        guard.dead = true;
        guard.vx = player.facing * 320;
        this.audio?.cue("gate", { pitch: 0.7, gain: 1.2, pan: this.panFor(guard.x) });
        this.emit("toast", guard.boss ? "Strážce padl. Maják čeká." : "Cesta je volná.");
        this.emitHud(true);
      }
    }
  }

  updateGuards(dt) {
    const player = this.player;
    for (const guard of this.world.guards) {
      if (guard.dead) continue;
      guard.invulnerable = Math.max(0, guard.invulnerable - dt);
      guard.cooldown = Math.max(0, guard.cooldown - dt);
      guard.stunned = Math.max(0, guard.stunned - dt);

      const dx = player.x + player.w / 2 - (guard.x + guard.w / 2);
      const distance = Math.abs(dx);
      const detectRange = (guard.range ?? 3) * TILE;
      if (dx !== 0) guard.facing = Math.sign(dx);

      if (guard.state === "windup") {
        guard.stateTimer -= dt;
        guard.vx = approach(guard.vx, 0, 1200 * dt);
        if (guard.stateTimer <= 0) this.guardStrike(guard);
      } else if (guard.state === "recover") {
        guard.stateTimer -= dt;
        guard.vx = approach(guard.vx, 0, 1000 * dt);
        if (guard.stateTimer <= 0) guard.state = "patrol";
      } else if (guard.stunned > 0) {
        guard.state = "stunned";
        guard.vx = approach(guard.vx, 0, 520 * dt);
      } else if (!player.dead && distance < 91 && guard.cooldown <= 0) {
        guard.state = "windup";
        guard.stateTimer = guard.boss && guard.health <= Math.ceil(guard.maxHealth / 2) ? 0.38 : guard.boss ? 0.47 : 0.58;
        this.audio?.cue("warning", { pitch: guard.boss ? 0.72 : 0.9, pan: this.panFor(guard.x) });
      } else if (!player.dead && distance < detectRange && distance > 73) {
        guard.state = "chase";
        guard.vx = approach(guard.vx, Math.sign(dx) * (guard.boss ? 118 : 96), 680 * dt);
      } else {
        guard.state = "patrol";
        const patrolRadius = Math.max(70, detectRange * 0.45);
        if (Math.abs(guard.x - guard.homeX) > patrolRadius) guard.vx = -Math.sign(guard.x - guard.homeX) * 54;
        else if (distance >= detectRange) guard.vx = approach(guard.vx, Math.sin(this.trapTime * 0.7 + guard.homeX) * 45, 240 * dt);
        else guard.vx = approach(guard.vx, 0, 700 * dt);
      }

      guard.vy = Math.min(guard.vy + GRAVITY * dt, 900);
      const motion = resolveMotion(guard, guard.vx * dt, guard.vy * dt, this.getSolids());
      guard.x = clamp(motion.x, 0, VIEW_W - guard.w);
      guard.y = motion.y;
      guard.onGround = motion.hitBottom;
      if (motion.hitBottom) guard.vy = 0;
      if (motion.hitLeft || motion.hitRight) guard.vx *= -0.35;
      if (guard.y > VIEW_H + 60) guard.dead = true;
    }
  }

  guardStrike(guard) {
    guard.state = "recover";
    guard.stateTimer = guard.boss ? 0.3 : 0.43;
    guard.cooldown = guard.boss ? 0.68 : 0.92;
    const attack = {
      x: guard.facing > 0 ? guard.x + guard.w - 2 : guard.x - 57,
      y: guard.y + 6,
      w: 59,
      h: 48,
    };
    this.audio?.cue("slash", { pitch: 0.72, pan: this.panFor(guard.x) });
    if (!this.player.dead && aabb(attack, this.player)) {
      const facingAttack = this.player.facing === -guard.facing;
      if (this.player.blocking && facingAttack) {
        this.audio?.cue("parry", { pan: this.panFor(this.player.x) });
        this.burst(this.player.x + this.player.w / 2, this.player.y + 18, this.room.palette.glow, 15);
        this.flash = 0.22;
        if (this.player.parryWindow > 0) {
          guard.stunned = guard.boss ? 0.72 : 0.95;
          guard.state = "stunned";
          guard.vx = -guard.facing * 145;
          this.emit("toast", "Odraženo — teď udeř!");
        } else {
          this.player.vx = guard.facing * 72;
        }
      } else {
        this.hurtPlayer("guard", guard.facing * (guard.boss ? 360 : 285));
      }
    }
  }

  hurtPlayer(source, knockback = 0, heavy = false, force = false) {
    const player = this.player;
    if (player.dead || (!force && player.invulnerable > 0)) return;
    player.health -= 1;
    player.invulnerable = 0.9;
    player.hanging = null;
    player.blocking = false;
    player.vx = knockback;
    player.vy = heavy ? -240 : -170;
    this.audio?.cue("hurt", { pan: this.panFor(player.x) });
    this.burst(player.x + player.w / 2, player.y + player.h / 2, "#f08b63", 13);
    this.shake = Math.max(this.shake, 0.46);
    this.flash = Math.max(this.flash, 0.24);
    this.emitHud(true);

    if (source === "abyss") {
      player.dead = true;
      player.deathTimer = 0.42;
      player.vy = 0;
      return;
    }
    if (player.health <= 0) {
      player.dead = true;
      player.deathTimer = 0.62;
      player.vy = -260;
    }
  }

  respawnPlayer() {
    this.deaths += 1;
    const hadHealth = this.player.health > 0;
    if (!hadHealth) {
      this.loadRoom(this.roomIndex, { checkpointActive: this.world.checkpoint.active });
      return;
    }

    const player = this.player;
    player.x = player.safeX;
    player.y = player.safeY;
    player.vx = 0;
    player.vy = 0;
    player.dead = false;
    player.deathTimer = 0;
    player.invulnerable = 1.1;
    this.emit("toast", "Světlo tě vrátilo k poslednímu znamení.");
    this.emit("save", this.snapshot());
    this.emitHud(true);
  }

  updateInteractions() {
    const playerCenter = this.player.x + this.player.w / 2;
    const playerFeet = this.player.y + this.player.h;
    const lever = this.world.levers.find(
      (candidate) => !candidate.active && Math.abs(candidate.x + candidate.w / 2 - playerCenter) < 58 && Math.abs(candidate.y + candidate.h - playerFeet) < 80,
    );
    const nearExit = Math.hypot(this.world.exit.x - playerCenter, this.world.exit.y - playerFeet) < 66;

    let prompt = "";
    if (lever) prompt = "Aktivovat páku";
    else if (nearExit) prompt = this.canExit() ? (this.roomIndex === ROOMS.length - 1 ? "Zapálit maják" : "Vstoupit dál") : "Strážce blokuje cestu";
    if (prompt !== this.prompt) {
      this.prompt = prompt;
      this.emit("prompt", prompt);
    }

    if (!this.input.consume("interact")) return;
    if (lever) {
      lever.active = true;
      const gate = this.world.gates.find((candidate) => candidate.id === lever.gateId);
      if (gate) gate.targetOpen = true;
      this.audio?.cue("switch", { pan: this.panFor(lever.x) });
      this.burst(lever.x + lever.w / 2, lever.y + 12, this.room.palette.glow, 12);
      this.emit("toast", "Ozubená kola se dala do pohybu.");
    } else if (nearExit && this.canExit()) {
      this.finishRoom();
    }
  }

  canExit() {
    return this.world.guards.every((guard) => guard.dead);
  }

  finishRoom() {
    this.audio?.cue(this.roomIndex === ROOMS.length - 1 ? "complete" : "room");
    this.flash = 0.8;
    if (this.roomIndex >= ROOMS.length - 1) {
      this.setMode("complete");
      this.audio?.setCombat(false);
      this.emit("complete", {
        elapsed: this.elapsed,
        time: formatTime(this.elapsed),
        shards: this.collectedShards.size,
        totalShards: 3,
        deaths: this.deaths,
      });
      return;
    }
    this.emit("transition");
    this.loadRoom(this.roomIndex + 1);
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.vy += 280 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.985;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  burst(x, y, color, count = 10) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.35;
      const speed = 45 + Math.random() * 155;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        life: 0.35 + Math.random() * 0.55,
        maxLife: 0.9,
        color,
        size: 1.3 + Math.random() * 2.6,
      });
    }
  }

  panFor(x) {
    return clamp((x / VIEW_W) * 2 - 1, -0.85, 0.85);
  }

  emitHud(force = false) {
    if (!force && this.elapsed - this.lastHudUpdate < 0.1) return;
    this.lastHudUpdate = this.elapsed;
    this.emit("hud", {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      room: this.room.name,
      shards: this.collectedShards.size,
      totalShards: 3,
      elapsed: this.elapsed,
      time: formatTime(this.elapsed),
    });
  }

  emit(type, payload) {
    this.onEvent(type, payload);
  }
}

import { TILE, VIEW_H, VIEW_W } from "./levels.js";
import { clamp, hash2d, lerp } from "./core.js";

const TAU = Math.PI * 2;

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mixColor(hex, amount = 0) {
  const value = Number.parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const weight = Math.abs(amount);
  const r = Math.round(lerp((value >> 16) & 255, target, weight));
  const g = Math.round(lerp((value >> 8) & 255, target, weight));
  const b = Math.round(lerp(value & 255, target, weight));
  return `rgb(${r} ${g} ${b})`;
}

export class CitadelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.dpr = 1;
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  resize() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    if (this.canvas.width !== VIEW_W * dpr || this.canvas.height !== VIEW_H * dpr) {
      this.dpr = dpr;
      this.canvas.width = VIEW_W * dpr;
      this.canvas.height = VIEW_H * dpr;
    }
  }

  render(game, timestamp) {
    const ctx = this.ctx;
    const room = game.room;
    const palette = room.palette;
    const time = timestamp / 1000;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    const shake = game.settings.reducedMotion ? 0 : game.shake;
    const shakeX = shake > 0 ? Math.sin(time * 97) * shake * 4 : 0;
    const shakeY = shake > 0 ? Math.cos(time * 83) * shake * 2 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.#background(ctx, room, time, game.roomIndex);
    this.#mechanismLinks(ctx, game, palette, time);
    this.#checkpointsAndExit(ctx, game, palette, time);
    this.#blocks(ctx, game, palette);
    this.#movingPlatforms(ctx, game, palette, time);
    this.#gates(ctx, game, palette);
    this.#traps(ctx, game, palette, time);
    this.#switches(ctx, game, palette, time);
    this.#shards(ctx, game, palette, time);
    this.#guards(ctx, game, time);
    this.#player(ctx, game.player, time);
    this.#particles(ctx, game.particles);
    this.#foreground(ctx, palette, time);

    ctx.restore();
    this.#vignette(ctx, palette, game);
  }

  #background(ctx, room, time, roomIndex) {
    const { palette } = room;
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    gradient.addColorStop(0, palette.sky);
    gradient.addColorStop(0.66, palette.far);
    gradient.addColorStop(1, mixColor(palette.sky, -0.32));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const moonX = 875 - roomIndex * 19;
    const moonY = 115 + Math.sin(roomIndex * 0.8) * 18;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, 105);
    moonGlow.addColorStop(0, `${palette.glow}b8`);
    moonGlow.addColorStop(0.25, `${palette.glow}38`);
    moonGlow.addColorStop(1, `${palette.glow}00`);
    ctx.fillStyle = moonGlow;
    ctx.fillRect(moonX - 110, moonY - 110, 220, 220);
    ctx.fillStyle = `${palette.glow}d9`;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 28, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.sky;
    ctx.beginPath();
    ctx.arc(moonX + 12, moonY - 9, 28, 0, TAU);
    ctx.fill();

    ctx.fillStyle = `${palette.glow}b0`;
    for (let index = 0; index < 46; index += 1) {
      const x = hash2d(index, roomIndex, 19) * VIEW_W;
      const y = hash2d(index, roomIndex, 47) * 340;
      const pulse = 0.35 + Math.sin(time * 1.2 + index) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.fillRect(Math.round(x), Math.round(y), index % 7 === 0 ? 2 : 1, index % 7 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = mixColor(palette.far, -0.25);
    for (let x = -40; x < VIEW_W + 100; x += 170) {
      const height = 160 + hash2d(x, roomIndex, 3) * 150;
      ctx.fillRect(x, VIEW_H - height - 82, 110, height);
      ctx.beginPath();
      ctx.moveTo(x - 14, VIEW_H - height - 82);
      ctx.lineTo(x + 55, VIEW_H - height - 137);
      ctx.lineTo(x + 124, VIEW_H - height - 82);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = `${palette.stoneTop}42`;
    ctx.lineWidth = 18;
    for (let x = 82; x < VIEW_W; x += 290) {
      ctx.beginPath();
      ctx.arc(x, 430, 92, Math.PI, TAU);
      ctx.lineTo(x + 92, 560);
      ctx.stroke();
    }

    ctx.strokeStyle = `${palette.accent}26`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(186, 192, 92, 0, TAU);
    ctx.arc(186, 192, 62, 0, TAU);
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * TAU + time * 0.012;
      ctx.moveTo(186 + Math.cos(angle) * 65, 192 + Math.sin(angle) * 65);
      ctx.lineTo(186 + Math.cos(angle) * 88, 192 + Math.sin(angle) * 88);
    }
    ctx.stroke();
  }

  #mechanismLinks(ctx, game, palette, time) {
    ctx.save();
    ctx.setLineDash([8, 9]);
    ctx.lineDashOffset = -time * 16;
    ctx.lineWidth = 2;
    for (const trigger of [...game.world.plates, ...game.world.levers]) {
      const gate = game.world.gates.find((candidate) => candidate.id === trigger.gateId);
      if (!gate) continue;
      ctx.strokeStyle = trigger.active ? `${palette.glow}cc` : `${palette.accent}72`;
      ctx.beginPath();
      ctx.moveTo(trigger.x + trigger.w / 2, trigger.y + trigger.h / 2);
      ctx.lineTo(trigger.x + trigger.w / 2, 520);
      ctx.lineTo(gate.x + gate.w / 2, 520);
      ctx.lineTo(gate.x + gate.w / 2, gate.y + gate.h);
      ctx.stroke();
    }
    ctx.restore();
  }

  #checkpointsAndExit(ctx, game, palette, time) {
    const checkpoint = game.world.checkpoint;
    const cpPulse = checkpoint.active ? 1 + Math.sin(time * 3) * 0.08 : 0.75;
    ctx.save();
    ctx.translate(checkpoint.x, checkpoint.y);
    ctx.scale(cpPulse, cpPulse);
    ctx.fillStyle = checkpoint.active ? palette.glow : `${palette.stoneTop}88`;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = checkpoint.active ? 22 : 4;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(9, -10);
    ctx.lineTo(0, -15);
    ctx.lineTo(-9, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-3, -11, 6, 11);
    ctx.restore();

    const exit = game.world.exit;
    const unlocked = game.canExit();
    ctx.save();
    ctx.translate(exit.x, exit.y);
    ctx.strokeStyle = unlocked ? palette.glow : palette.stoneTop;
    ctx.fillStyle = unlocked ? `${palette.glow}22` : `${palette.sky}aa`;
    ctx.lineWidth = 5;
    ctx.shadowColor = unlocked ? palette.glow : "transparent";
    ctx.shadowBlur = unlocked ? 24 + Math.sin(time * 3) * 7 : 0;
    ctx.beginPath();
    ctx.arc(0, -56, 32, Math.PI, TAU);
    ctx.lineTo(32, 0);
    ctx.lineTo(-32, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-11, -22);
    ctx.lineTo(0, -36 - Math.sin(time * 2) * 2);
    ctx.lineTo(11, -22);
    ctx.stroke();
    ctx.restore();
  }

  #blocks(ctx, game, palette) {
    for (const block of game.world.blocks) {
      if (block.kind === "crumble" && block.fall > 1.15) continue;
      const offsetY = block.kind === "crumble" ? Math.max(0, block.fall - 0.55) ** 2 * 170 : 0;
      const alpha = block.kind === "crumble" ? clamp(2.3 - block.fall, 0, 1) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, offsetY);
      ctx.fillStyle = palette.stone;
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.fillStyle = palette.stoneTop;
      ctx.fillRect(block.x, block.y, block.w, Math.min(7, block.h));
      ctx.fillStyle = `${palette.sky}22`;
      ctx.fillRect(block.x, block.y + block.h - 9, block.w, 9);

      const columns = Math.ceil(block.w / TILE);
      const rows = Math.ceil(block.h / 32);
      ctx.strokeStyle = `${palette.sky}5c`;
      ctx.lineWidth = 1;
      for (let row = 0; row < rows; row += 1) {
        const y = block.y + row * 32;
        const offset = row % 2 ? TILE / 2 : 0;
        ctx.beginPath();
        ctx.moveTo(block.x, y);
        ctx.lineTo(block.x + block.w, y);
        for (let column = -1; column <= columns; column += 1) {
          const x = block.x + column * TILE + offset;
          ctx.moveTo(x, y);
          ctx.lineTo(x, Math.min(y + 32, block.y + block.h));
        }
        ctx.stroke();
      }
      if (block.kind === "crumble") {
        ctx.strokeStyle = `${palette.glow}88`;
        ctx.beginPath();
        ctx.moveTo(block.x + 13, block.y + 5);
        ctx.lineTo(block.x + block.w * 0.45, block.y + 22);
        ctx.lineTo(block.x + block.w * 0.7, block.y + 8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  #movingPlatforms(ctx, game, palette, time) {
    for (const platform of game.world.movingPlatforms) {
      ctx.save();
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 8;
      ctx.fillStyle = palette.stoneTop;
      roundedRect(ctx, platform.x, platform.y, platform.w, platform.h, 5);
      ctx.fill();
      ctx.fillStyle = palette.accent;
      ctx.fillRect(platform.x + 7, platform.y + 5, platform.w - 14, 3);
      ctx.strokeStyle = `${palette.glow}9c`;
      ctx.lineWidth = 2;
      for (let x = platform.x + 18; x < platform.x + platform.w - 5; x += 28) {
        ctx.beginPath();
        ctx.arc(x, platform.y + platform.h / 2, 4 + Math.sin(time * 4 + x) * 0.6, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  #gates(ctx, game, palette) {
    for (const gate of game.world.gates) {
      if (gate.open > 0.985) continue;
      ctx.save();
      ctx.translate(0, -gate.open * (gate.h + 16));
      ctx.fillStyle = mixColor(palette.stoneTop, -0.2);
      for (let x = gate.x + 8; x < gate.x + gate.w; x += 14) {
        roundedRect(ctx, x, gate.y, 7, gate.h, 3);
        ctx.fill();
      }
      ctx.fillStyle = palette.accent;
      ctx.fillRect(gate.x + 3, gate.y + gate.h - 13, gate.w - 6, 8);
      ctx.restore();
    }
  }

  #traps(ctx, game, palette, time) {
    for (const spike of game.world.spikes) {
      const height = 8 + spike.extension * 28;
      const count = Math.max(2, Math.round(spike.w / 18));
      ctx.fillStyle = spike.warning ? palette.glow : mixColor(palette.stoneTop, 0.25);
      ctx.shadowColor = spike.warning ? palette.glow : "transparent";
      ctx.shadowBlur = spike.warning ? 14 : 0;
      for (let index = 0; index < count; index += 1) {
        const left = spike.x + (index / count) * spike.w;
        const right = spike.x + ((index + 1) / count) * spike.w;
        ctx.beginPath();
        ctx.moveTo(left + 1, spike.y);
        ctx.lineTo((left + right) / 2, spike.y - height);
        ctx.lineTo(right - 1, spike.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    for (const blade of game.world.blades) {
      ctx.save();
      ctx.strokeStyle = `${palette.stoneTop}d9`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(blade.anchorX, blade.anchorY);
      ctx.lineTo(blade.tipX, blade.tipY);
      ctx.stroke();
      ctx.translate(blade.tipX, blade.tipY);
      ctx.rotate(-blade.angle + Math.PI / 4);
      ctx.shadowColor = blade.warning ? palette.glow : "transparent";
      ctx.shadowBlur = blade.warning ? 20 : 0;
      ctx.fillStyle = blade.warning ? palette.glow : mixColor(palette.stoneTop, 0.34);
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(30, 0);
      ctx.lineTo(0, 28);
      ctx.lineTo(8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = palette.stone;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  #switches(ctx, game, palette, time) {
    for (const plate of game.world.plates) {
      ctx.fillStyle = plate.active ? palette.glow : palette.accent;
      ctx.shadowColor = plate.active ? palette.glow : "transparent";
      ctx.shadowBlur = plate.active ? 15 : 0;
      roundedRect(ctx, plate.x, plate.y + (plate.active ? 4 : 0), plate.w, plate.h, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.sky;
      ctx.fillRect(plate.x + plate.w / 2 - 5, plate.y + 4, 10, 3);
    }

    for (const lever of game.world.levers) {
      ctx.save();
      ctx.translate(lever.x + lever.w / 2, lever.y + lever.h);
      ctx.rotate(lever.active ? 0.72 : -0.72);
      ctx.strokeStyle = lever.active ? palette.glow : palette.stoneTop;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -35);
      ctx.stroke();
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(0, -39, 8 + Math.sin(time * 3) * 0.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  #shards(ctx, game, palette, time) {
    for (const shard of game.world.shards) {
      if (shard.collected) continue;
      ctx.save();
      ctx.translate(shard.x, shard.y + Math.sin(time * 2.4 + shard.x) * 7);
      ctx.rotate(time * 0.45);
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 24;
      ctx.fillStyle = palette.glow;
      ctx.beginPath();
      for (let point = 0; point < 10; point += 1) {
        const radius = point % 2 ? 7 : 18;
        const angle = -Math.PI / 2 + (point / 10) * TAU;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  #player(ctx, player, time) {
    if (!player) return;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 15) % 2 === 0) return;
    const feetX = player.x + player.w / 2;
    const feetY = player.y + player.h;
    const speed = Math.abs(player.vx);
    const run = player.onGround ? Math.sin(time * (5 + speed * 0.045)) : 0;
    const crouch = player.crouched ? 13 : 0;
    const attackProgress = player.attackTimer > 0 ? 1 - player.attackTimer / player.attackDuration : 0;
    const scarfWave = Math.sin(time * 8) * 5 + clamp(speed / 32, 0, 10);

    ctx.save();
    ctx.translate(feetX, feetY);
    ctx.scale(player.facing, 1);
    if (player.hanging) ctx.rotate(player.hanging.side * -0.03);

    ctx.strokeStyle = "#182736";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (player.hanging) {
      ctx.moveTo(-7, -29);
      ctx.lineTo(-3, -6);
      ctx.moveTo(6, -29);
      ctx.lineTo(10, -6);
    } else if (player.onGround) {
      ctx.moveTo(-4, -24 + crouch);
      ctx.lineTo(-9 - run * 7, -4);
      ctx.lineTo(-14 - run * 5, 0);
      ctx.moveTo(4, -24 + crouch);
      ctx.lineTo(8 + run * 7, -5);
      ctx.lineTo(13 + run * 5, 0);
    } else {
      ctx.moveTo(-4, -24);
      ctx.quadraticCurveTo(-13, -11, -9, -2);
      ctx.moveTo(4, -24);
      ctx.quadraticCurveTo(14, -12, 10, -4);
    }
    ctx.stroke();

    ctx.fillStyle = "#1b7f86";
    ctx.strokeStyle = "#7ff5dd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -48 + crouch);
    ctx.quadraticCurveTo(0, -57 + crouch, 12, -47 + crouch);
    ctx.lineTo(10, -20 + crouch);
    ctx.quadraticCurveTo(0, -13 + crouch, -10, -20 + crouch);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#f2b85c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-7, -40 + crouch);
    ctx.bezierCurveTo(-22, -43, -28 - scarfWave, -31, -38 - scarfWave, -35 + run * 2);
    ctx.stroke();

    ctx.fillStyle = "#d9a77a";
    ctx.beginPath();
    ctx.arc(1, -58 + crouch, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#182736";
    ctx.beginPath();
    ctx.arc(-2, -62 + crouch, 10, Math.PI, TAU);
    ctx.lineTo(11, -54 + crouch);
    ctx.lineTo(6, -67 + crouch);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7dd92";
    ctx.fillRect(7, -59 + crouch, 3, 2);

    ctx.strokeStyle = "#d9a77a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (player.hanging) {
      ctx.moveTo(-7, -43);
      ctx.lineTo(-6, -68);
      ctx.moveTo(7, -43);
      ctx.lineTo(10, -68);
    } else if (player.blocking) {
      ctx.moveTo(7, -41 + crouch);
      ctx.lineTo(22, -55 + crouch);
    } else {
      ctx.moveTo(8, -42 + crouch);
      ctx.lineTo(18 + run * 2, -26 + crouch);
    }
    ctx.stroke();

    if (player.combat || player.attackTimer > 0) {
      let swordAngle = -0.6;
      if (player.blocking) swordAngle = -1.45;
      if (player.attackTimer > 0) swordAngle = lerp(-1.9, 0.75, Math.sin(attackProgress * Math.PI));
      ctx.save();
      ctx.translate(18, -43 + crouch);
      ctx.rotate(swordAngle);
      ctx.strokeStyle = "#dcebf0";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#baf6de";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(45, 0);
      ctx.stroke();
      ctx.fillStyle = "#f2b85c";
      ctx.fillRect(-3, -5, 9, 10);
      ctx.restore();
    }
    ctx.restore();
  }

  #guards(ctx, game, time) {
    for (const guard of game.world.guards) {
      if (guard.dead) continue;
      if (guard.invulnerable > 0 && Math.floor(guard.invulnerable * 18) % 2 === 0) continue;
      const feetX = guard.x + guard.w / 2;
      const feetY = guard.y + guard.h;
      const palette = game.room.palette;
      const windup = guard.state === "windup";
      ctx.save();
      ctx.translate(feetX, feetY);
      ctx.scale(guard.facing, 1);

      ctx.strokeStyle = "#171a24";
      ctx.lineWidth = guard.boss ? 10 : 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-7, -23);
      ctx.lineTo(-11, 0);
      ctx.moveTo(7, -23);
      ctx.lineTo(12, 0);
      ctx.stroke();

      const bodyGradient = ctx.createLinearGradient(-18, -55, 18, -20);
      bodyGradient.addColorStop(0, guard.boss ? "#9d4d45" : "#6e536c");
      bodyGradient.addColorStop(1, "#322e3e");
      ctx.fillStyle = bodyGradient;
      ctx.strokeStyle = guard.boss ? palette.glow : palette.accent;
      ctx.lineWidth = 2;
      roundedRect(ctx, -16, -54, 32, 36, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#b6884d";
      ctx.beginPath();
      ctx.arc(0, -63, guard.boss ? 15 : 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#171a24";
      ctx.fillRect(-12, -68, 25, 9);
      ctx.fillStyle = windup ? palette.glow : "#ef6f60";
      ctx.shadowColor = windup ? palette.glow : "#ef6f60";
      ctx.shadowBlur = windup ? 18 : 7;
      ctx.fillRect(6, -65, 5, 3);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = "#b6884d";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(12, -46);
      ctx.lineTo(windup ? 24 : 20, windup ? -63 : -31);
      ctx.stroke();

      ctx.save();
      ctx.translate(windup ? 23 : 19, windup ? -64 : -32);
      ctx.rotate(windup ? -1.5 + Math.sin(time * 18) * 0.05 : -0.35);
      ctx.strokeStyle = "#e3e8e6";
      ctx.lineWidth = guard.boss ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(48 + (guard.boss ? 10 : 0), 0);
      ctx.stroke();
      ctx.restore();

      const pipWidth = 8;
      for (let index = 0; index < guard.maxHealth; index += 1) {
        ctx.fillStyle = index < guard.health ? palette.glow : `${palette.stoneTop}55`;
        ctx.fillRect((index - (guard.maxHealth - 1) / 2) * (pipWidth + 3) - pipWidth / 2, -91, pipWidth, 3);
      }
      ctx.restore();
    }
  }

  #particles(ctx, particles) {
    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  #foreground(ctx, palette, time) {
    ctx.fillStyle = `${palette.glow}26`;
    for (let index = 0; index < 18; index += 1) {
      const x = (hash2d(index, 2, 91) * VIEW_W + time * (5 + (index % 3))) % VIEW_W;
      const y = 180 + ((hash2d(index, 9, 83) * 480 + time * (index % 2 ? 4 : -3)) % 480);
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + (index % 3) * 0.45, 0, TAU);
      ctx.fill();
    }
  }

  #vignette(ctx, palette, game) {
    const gradient = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.24, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.64);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(1, `${palette.sky}d6`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (!game.settings.reducedMotion && game.flash > 0) {
      ctx.fillStyle = `rgba(255, 224, 163, ${game.flash * 0.24})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}

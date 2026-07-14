export const EPSILON = 0.0001;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

export function approach(current, target, delta) {
  if (current < target) return Math.min(current + delta, target);
  if (current > target) return Math.max(current - delta, target);
  return target;
}

export function aabb(a, b, inset = 0) {
  return (
    a.x + inset < b.x + b.w - inset &&
    a.x + a.w - inset > b.x + inset &&
    a.y + inset < b.y + b.h - inset &&
    a.y + a.h - inset > b.y + inset
  );
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function hash2d(x, y, seed = 0) {
  let value = Math.imul((x | 0) ^ seed, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16) ^ (y | 0), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

/**
 * Separates a body from axis-aligned solids one axis at a time. The crossing
 * tests make the result stable even if a frame arrives late; the game still
 * uses a fixed simulation step, but this prevents small walls being skipped.
 */
export function resolveMotion(body, dx, dy, solids) {
  let x = body.x;
  let y = body.y;
  let hitLeft = false;
  let hitRight = false;
  let hitTop = false;
  let hitBottom = false;
  let floor = null;
  let wall = null;

  // Recover from shallow dynamic overlap (for example a moving platform
  // lifting a character into an arch). Static contacts have zero overlap and
  // are left untouched. Four passes also handle a corner shared by two solids.
  for (let pass = 0; pass < 4; pass += 1) {
    let separated = false;
    for (const solid of solids) {
      if (solid.disabled) continue;
      const probe = { x, y, w: body.w, h: body.h };
      if (!aabb(probe, solid)) continue;

      const pushLeft = x + body.w - solid.x;
      const pushRight = solid.x + solid.w - x;
      const pushUp = y + body.h - solid.y;
      const pushDown = solid.y + solid.h - y;
      const smallest = Math.min(pushLeft, pushRight, pushUp, pushDown);

      if (smallest === pushUp) {
        y -= pushUp;
        hitBottom = true;
        floor = solid;
      } else if (smallest === pushDown) {
        y += pushDown;
        hitTop = true;
      } else if (smallest === pushLeft) {
        x -= pushLeft;
        hitRight = true;
        wall = solid;
      } else {
        x += pushRight;
        hitLeft = true;
        wall = solid;
      }
      separated = true;
    }
    if (!separated) break;
  }

  if (dx !== 0) {
    let targetX = x + dx;

    for (const solid of solids) {
      if (solid.disabled) continue;
      const verticalOverlap = y + body.h > solid.y + EPSILON && y < solid.y + solid.h - EPSILON;
      if (!verticalOverlap) continue;

      if (dx > 0) {
        const startEdge = x + body.w;
        const targetEdge = targetX + body.w;
        if (startEdge <= solid.x + EPSILON && targetEdge > solid.x) {
          targetX = Math.min(targetX, solid.x - body.w);
          hitRight = true;
          wall = solid;
        }
      } else {
        const startEdge = x;
        const targetEdge = targetX;
        const solidEdge = solid.x + solid.w;
        if (startEdge >= solidEdge - EPSILON && targetEdge < solidEdge) {
          targetX = Math.max(targetX, solidEdge);
          hitLeft = true;
          wall = solid;
        }
      }
    }

    x = targetX;
  }

  if (dy !== 0) {
    let targetY = y + dy;

    for (const solid of solids) {
      if (solid.disabled) continue;
      const horizontalOverlap = x + body.w > solid.x + EPSILON && x < solid.x + solid.w - EPSILON;
      if (!horizontalOverlap) continue;

      if (dy > 0) {
        const startEdge = y + body.h;
        const targetEdge = targetY + body.h;
        if (startEdge <= solid.y + EPSILON && targetEdge > solid.y) {
          targetY = Math.min(targetY, solid.y - body.h);
          hitBottom = true;
          floor = solid;
        }
      } else {
        const startEdge = y;
        const targetEdge = targetY;
        const solidEdge = solid.y + solid.h;
        if (startEdge >= solidEdge - EPSILON && targetEdge < solidEdge) {
          targetY = Math.max(targetY, solidEdge);
          hitTop = true;
        }
      }
    }

    y = targetY;
  }

  return {
    x,
    y,
    hitLeft,
    hitRight,
    hitTop,
    hitBottom,
    floor,
    wall,
  };
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function damp(current, target, smoothing, dt) {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

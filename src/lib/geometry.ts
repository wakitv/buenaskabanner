/**
 * All box geometry lives in ORIGINAL banner pixel coordinates.
 * The preview converts these to percentages, and the export uses them directly,
 * so the preview and the downloaded PNG always line up exactly.
 *
 * The target box can be any rectangle. The QR code itself always stays a
 * perfect square (stretching it would make it unscannable): it is the largest
 * square that fits, centred in the box.
 */

export type Rect = { x: number; y: number; w: number; h: number }
export type Handle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
export type Point = { x: number; y: number }

export const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max)

/** Smallest allowed box edge, in original banner pixels. */
export function minBoxSize(w: number, h: number): number {
  const shortest = Math.min(w, h)
  return Math.min(Math.max(24, Math.round(shortest * 0.04)), shortest)
}

/** A centred square covering ~30% of the banner's shorter side. */
export function initialRect(w: number, h: number): Rect {
  const size = Math.round(Math.min(w, h) * 0.3)
  return { x: Math.round((w - size) / 2), y: Math.round((h - size) / 2), w: size, h: size }
}

/** The square the QR code occupies: largest square that fits, centred in the box. */
export function qrBox(r: Rect): { x: number; y: number; size: number } {
  const size = Math.min(r.w, r.h)
  return { x: r.x + (r.w - size) / 2, y: r.y + (r.h - size) / 2, size }
}

/** Shrink the box to a square around its centre. */
export function makeSquare(r: Rect): Rect {
  const q = qrBox(r)
  return { x: q.x, y: q.y, w: q.size, h: q.size }
}

/** Move by (dx, dy) while keeping the whole box inside the banner. */
export function moveRect(r: Rect, dx: number, dy: number, w: number, h: number): Rect {
  return {
    w: r.w,
    h: r.h,
    x: clamp(r.x + dx, 0, w - r.w),
    y: clamp(r.y + dy, 0, h - r.h),
  }
}

/**
 * Resize from a handle. Side handles change one dimension; corner handles
 * change both (or keep the current proportions when `keepRatio` is set).
 * The opposite side/corner stays fixed and the box can never leave the banner
 * or become smaller than the minimum size.
 */
export function resizeRect(
  o: Rect,
  handle: Handle,
  p: Point,
  W: number,
  H: number,
  keepRatio = false,
): Rect {
  const min = minBoxSize(W, H)
  const hasW = handle.includes('w')
  const hasE = handle.includes('e')
  const hasN = handle.includes('n')
  const hasS = handle.includes('s')
  const right0 = o.x + o.w
  const bottom0 = o.y + o.h

  if (keepRatio && handle.length === 2) {
    const ax = hasW ? right0 : o.x // fixed (opposite) corner
    const ay = hasN ? bottom0 : o.y
    const sx = hasW ? -1 : 1
    const sy = hasN ? -1 : 1
    const ratio = o.w / o.h
    const maxW = Math.min(hasW ? ax : W - ax, (hasN ? ay : H - ay) * ratio)
    const minW = Math.max(min, min * ratio)
    const rawW = Math.max((p.x - ax) * sx, (p.y - ay) * sy * ratio)
    const w = clamp(rawW, Math.min(minW, maxW), maxW)
    const h = w / ratio
    return { x: hasW ? ax - w : ax, y: hasN ? ay - h : ay, w, h }
  }

  let left = o.x
  let right = right0
  let top = o.y
  let bottom = bottom0
  if (hasW) left = clamp(p.x, 0, right0 - min)
  if (hasE) right = clamp(p.x, o.x + min, W)
  if (hasN) top = clamp(p.y, 0, bottom0 - min)
  if (hasS) bottom = clamp(p.y, o.y + min, H)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

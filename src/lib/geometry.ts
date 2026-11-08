/**
 * All square geometry lives in ORIGINAL banner pixel coordinates.
 * The preview converts these to percentages, and the export uses them directly,
 * so the preview and the downloaded PNG always line up exactly.
 */

export type Square = { x: number; y: number; size: number }
export type Corner = 'nw' | 'ne' | 'sw' | 'se'
export type Point = { x: number; y: number }

export const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max)

/** Smallest allowed square edge, in original banner pixels. */
export function minSquareSize(w: number, h: number): number {
  const shortest = Math.min(w, h)
  return Math.min(Math.max(24, Math.round(shortest * 0.04)), shortest)
}

/** A centred square covering ~30% of the banner's shorter side. */
export function initialSquare(w: number, h: number): Square {
  const size = Math.round(Math.min(w, h) * 0.3)
  return { x: Math.round((w - size) / 2), y: Math.round((h - size) / 2), size }
}

/** Move by (dx, dy) while keeping the whole square inside the banner. */
export function moveSquare(sq: Square, dx: number, dy: number, w: number, h: number): Square {
  return {
    size: sq.size,
    x: clamp(sq.x + dx, 0, w - sq.size),
    y: clamp(sq.y + dy, 0, h - sq.size),
  }
}

/**
 * Resize from a corner handle. The opposite corner stays fixed, the result is
 * always a perfect square, and it can never leave the banner.
 */
export function resizeSquare(sq: Square, corner: Corner, p: Point, w: number, h: number): Square {
  const east = corner === 'ne' || corner === 'se'
  const south = corner === 'sw' || corner === 'se'
  const anchor: Point = {
    x: east ? sq.x : sq.x + sq.size,
    y: south ? sq.y : sq.y + sq.size,
  }
  const sx = east ? 1 : -1
  const sy = south ? 1 : -1

  // Project the pointer onto the diagonal so growing/shrinking feels natural.
  const raw = ((p.x - anchor.x) * sx + (p.y - anchor.y) * sy) / 2

  const maxSize = Math.min(east ? w - anchor.x : anchor.x, south ? h - anchor.y : anchor.y)
  const minSize = Math.min(minSquareSize(w, h), maxSize)
  const size = clamp(raw, minSize, maxSize)

  return {
    size,
    x: east ? anchor.x : anchor.x - size,
    y: south ? anchor.y : anchor.y - size,
  }
}

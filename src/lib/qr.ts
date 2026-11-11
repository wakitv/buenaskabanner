import QRCode from 'qrcode'

export type QrMatrix = {
  /** Number of modules per side (without quiet zone). */
  size: number
  /** Row-major, 1 = dark module. */
  dark: Uint8Array
}

export type QrShape = 'square' | 'rounded' | 'dots'

export type QrStyle = {
  /** Colour of the QR modules. */
  fg: string
  /** Background colour (also used for the quiet zone). */
  bg: string
  /** Leave the background see-through so the banner shows behind the QR. */
  transparent: boolean
  shape: QrShape
  /** Show the Buenas logo in the centre. */
  logo: boolean
  /** Logo side as a fraction of the QR data area (0.15 – 0.30). */
  logoScale: number
}

export const DEFAULT_STYLE: QrStyle = {
  fg: '#000000',
  bg: '#ffffff',
  transparent: false,
  shape: 'square',
  logo: true,
  logoScale: 0.22,
}

export const LOGO_SCALE_MIN = 0.15
export const LOGO_SCALE_MAX = 0.3

/** Quiet zone in modules. 4 is the QR specification minimum. */
export const QUIET_ZONE = 4

/**
 * Error correction:
 *  - "H" (~30% recovery) when a logo covers the centre,
 *  - "Q" (~25%) otherwise, which keeps plain codes less dense.
 */
export function createQrMatrix(text: string, withLogo: boolean): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: withLogo ? 'H' : 'Q' })
  const size = qr.modules.size
  const dark = new Uint8Array(size * size)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      dark[r * size + c] = qr.modules.get(r, c) ? 1 : 0
    }
  }
  return { size, dark }
}

/** Total modules per side including the quiet zone on both sides. */
export const totalModules = (m: QrMatrix) => m.size + QUIET_ZONE * 2

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Draw the QR code (background + quiet zone + modules + optional centre logo)
 * so that it exactly fills the square (x, y, size).
 *
 * The three corner "eyes" are always drawn as solid squares, whatever the
 * module shape, so every style stays easy for phone cameras to detect.
 */
export function drawQr(
  ctx: CanvasRenderingContext2D,
  m: QrMatrix,
  x: number,
  y: number,
  size: number,
  style: QrStyle,
  logo: HTMLImageElement | null,
): void {
  const n = m.size
  const total = n + QUIET_ZONE * 2
  const cell = size / total
  // Whole-pixel module edges for square modules: crisp, no seams or blur.
  const edge = (i: number) => Math.round((i * size) / total)

  const showLogo = style.logo && !!logo
  // Logo box (px, relative to the QR square), centred.
  const boxSide = style.logoScale * n * cell
  const half = boxSide / 2 + cell * 0.35 // clear area includes a small margin
  const mid = size / 2

  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (!style.transparent) {
    ctx.fillStyle = style.bg
    ctx.fillRect(x, y, size, size)
  }
  ctx.fillStyle = style.fg

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m.dark[r * n + c]) continue

      const x0 = (c + QUIET_ZONE) * cell
      const y0 = (r + QUIET_ZONE) * cell
      // Skip modules that touch the logo area; the logo replaces them.
      if (
        showLogo &&
        x0 + cell > mid - half &&
        x0 < mid + half &&
        y0 + cell > mid - half &&
        y0 < mid + half
      ) {
        continue
      }

      if (style.shape === 'square' || isFinder(r, c)) {
        const left = edge(c + QUIET_ZONE)
        const right = edge(c + 1 + QUIET_ZONE)
        const top = edge(r + QUIET_ZONE)
        const bottom = edge(r + 1 + QUIET_ZONE)
        ctx.fillRect(x + left, y + top, right - left, bottom - top)
      } else if (style.shape === 'rounded') {
        roundRectPath(ctx, x + x0, y + y0, cell, cell, cell * 0.32)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(x + x0 + cell / 2, y + y0 + cell / 2, cell * 0.47, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  if (showLogo && logo) {
    // Background plate keeps a clean margin around the logo (not when transparent).
    if (!style.transparent) {
      ctx.fillStyle = style.bg
      roundRectPath(ctx, x + mid - half, y + mid - half, half * 2, half * 2, half * 0.28)
      ctx.fill()
    }

    const bx = x + mid - boxSide / 2
    const by = y + mid - boxSide / 2
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    roundRectPath(ctx, bx, by, boxSide, boxSide, boxSide * 0.16)
    ctx.clip()
    ctx.drawImage(logo, bx, by, boxSide, boxSide)
  }
  ctx.restore()
}

/**
 * Edge length for a preview canvas: a whole number of pixels per module,
 * at least ~1024px, so the on-screen QR is crisp.
 */
export function previewCanvasSize(m: QrMatrix): number {
  const total = totalModules(m)
  return total * Math.max(4, Math.ceil(1024 / total))
}

/** Normalise and validate a website URL. Returns null if invalid. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw || /\s/.test(raw)) return null
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const host = u.hostname
    if (host !== 'localhost' && !/^[^.]+(\.[^.]+)+$/.test(host)) return null
    return candidate
  } catch {
    return null
  }
}

/** WCAG-style contrast ratio between two #rrggbb colours (1 – 21). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const [r, g, bl] = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const la = lum(a)
  const lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const srgbToLinear = (v: number) => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance (0 – 1) of a #rrggbb colour. */
export function hexLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * What the QR would sit on when its background is transparent: the average
 * brightness of the banner under the square, and how "busy" (uneven) it is.
 */
export function sampleBackdrop(
  img: HTMLImageElement,
  sq: { x: number; y: number; size: number },
): { lum: number; spread: number; texture: number } | null {
  const N = 24
  const canvas = document.createElement('canvas')
  canvas.width = N
  canvas.height = N
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.fillStyle = '#ffffff' // transparent PNG areas count as white
  ctx.fillRect(0, 0, N, N)
  ctx.drawImage(img, sq.x, sq.y, sq.size, sq.size, 0, 0, N, N)
  const { data } = ctx.getImageData(0, 0, N, N)
  const lums: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    lums.push(
      0.2126 * srgbToLinear(data[i]) + 0.7152 * srgbToLinear(data[i + 1]) + 0.0722 * srgbToLinear(data[i + 2]),
    )
  }
  const lum = lums.reduce((a, b) => a + b, 0) / lums.length
  const spread = Math.sqrt(lums.reduce((a, b) => a + (b - lum) ** 2, 0) / lums.length)

  // Fine detail (patterns, noise, photo texture) is averaged away by the
  // smoothed sample above, so measure it separately on raw pixels: the mean
  // brightness jump between neighbouring samples.
  const T = 64
  const tex = document.createElement('canvas')
  tex.width = T
  tex.height = T
  const tctx = tex.getContext('2d', { willReadFrequently: true })
  let texture = 0
  if (tctx) {
    tctx.fillStyle = '#ffffff'
    tctx.fillRect(0, 0, T, T)
    tctx.imageSmoothingEnabled = false
    tctx.drawImage(img, sq.x, sq.y, sq.size, sq.size, 0, 0, T, T)
    const d = tctx.getImageData(0, 0, T, T).data
    const L = (i: number) =>
      0.2126 * srgbToLinear(d[i]) + 0.7152 * srgbToLinear(d[i + 1]) + 0.0722 * srgbToLinear(d[i + 2])
    let sum = 0
    let n = 0
    for (let row = 0; row < T; row++) {
      for (let col = 0; col < T - 1; col++) {
        sum += Math.abs(L((row * T + col) * 4) - L((row * T + col + 1) * 4))
        n++
      }
    }
    texture = sum / n
  }
  return { lum, spread, texture }
}

/** Relative luminance helper used to detect inverted (light-on-dark) codes. */
export function isInverted(fg: string, bg: string): boolean {
  const l = (hex: string) =>
    [1, 3, 5].reduce((s, i, k) => s + parseInt(hex.slice(i, i + 2), 16) * [0.2126, 0.7152, 0.0722][k], 0)
  return l(fg) > l(bg)
}

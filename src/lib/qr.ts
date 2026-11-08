import QRCode from 'qrcode'

export type QrMatrix = {
  /** Number of modules per side (without quiet zone). */
  size: number
  /** Row-major, 1 = dark module. */
  dark: Uint8Array
}

/** Quiet zone in modules. 4 is the QR specification minimum. */
export const QUIET_ZONE = 4

/**
 * Error correction "Q" (~25% recovery): a good balance between density and
 * robustness for codes that get scaled, printed or compressed on a banner.
 */
export function createQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'Q' })
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

/**
 * Draw the QR code (white background + quiet zone + black modules) so that it
 * exactly fills the square (x, y, size). Module edges are snapped to whole
 * pixels so the result is crisp with no seams or blur at any size.
 */
export function drawQr(
  ctx: CanvasRenderingContext2D,
  m: QrMatrix,
  x: number,
  y: number,
  size: number,
): void {
  const total = totalModules(m)
  const edge = (i: number) => Math.round((i * size) / total)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = '#000000'

  for (let r = 0; r < m.size; r++) {
    let c = 0
    while (c < m.size) {
      if (!m.dark[r * m.size + c]) {
        c++
        continue
      }
      // Merge horizontal runs of dark modules into one rectangle.
      let end = c
      while (end + 1 < m.size && m.dark[r * m.size + end + 1]) end++
      const left = edge(c + QUIET_ZONE)
      const right = edge(end + 1 + QUIET_ZONE)
      const top = edge(r + QUIET_ZONE)
      const bottom = edge(r + 1 + QUIET_ZONE)
      ctx.fillRect(x + left, y + top, right - left, bottom - top)
      c = end + 1
    }
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

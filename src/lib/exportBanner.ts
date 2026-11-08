import type { Square } from './geometry'
import { drawQr, type QrMatrix, type QrStyle } from './qr'

export const DOWNLOAD_NAME = 'wackybuds-buenas-banner.png'

/**
 * Composite the banner and QR code at the banner's ORIGINAL resolution and
 * return a PNG blob. The target outline and handles are never drawn here.
 */
export function renderFinalBanner(
  img: HTMLImageElement,
  width: number,
  height: number,
  square: Square,
  qr: QrMatrix,
  qrStyle: QrStyle,
  logoImg: HTMLImageElement | null,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas is not supported in this browser.'))

  ctx.drawImage(img, 0, 0, width, height)

  // Snap to whole pixels, then clamp so rounding can never push it off-canvas.
  const size = Math.max(1, Math.min(Math.round(square.size), width, height))
  const x = Math.min(Math.max(Math.round(square.x), 0), width - size)
  const y = Math.min(Math.max(Math.round(square.y), 0), height - size)
  drawQr(ctx, qr, x, y, size, qrStyle, logoImg)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('This banner is too large for your browser to export.'))
    }, 'image/png')
  })
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

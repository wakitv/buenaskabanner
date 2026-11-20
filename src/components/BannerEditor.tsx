import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { moveRect, qrBox, resizeRect, type Handle, type Point, type Rect } from '../lib/geometry'
import { drawQr, previewCanvasSize, type QrMatrix, type QrStyle } from '../lib/qr'

type Props = {
  src: string
  width: number
  height: number
  box: Rect
  onBoxChange: (box: Rect) => void
  qr: QrMatrix | null
  qrStyle: QrStyle
  logoImg: HTMLImageElement | null
  /** Draw the QR under the banner instead of on top of it. */
  behind: boolean
}

type Drag = {
  mode: 'move' | Handle
  start: Point
  origin: Rect
}

const BASE = 'absolute -translate-x-1/2 -translate-y-1/2 touch-none border-2 border-black bg-buenas-yellow shadow'
const HANDLES: { id: Handle; cls: string }[] = [
  { id: 'nw', cls: 'left-0 top-0 h-5 w-5 rounded-full cursor-nwse-resize' },
  { id: 'ne', cls: 'left-full top-0 h-5 w-5 rounded-full cursor-nesw-resize' },
  { id: 'sw', cls: 'left-0 top-full h-5 w-5 rounded-full cursor-nesw-resize' },
  { id: 'se', cls: 'left-full top-full h-5 w-5 rounded-full cursor-nwse-resize' },
  { id: 'n', cls: 'left-1/2 top-0 h-3.5 w-9 rounded-full cursor-ns-resize' },
  { id: 's', cls: 'left-1/2 top-full h-3.5 w-9 rounded-full cursor-ns-resize' },
  { id: 'w', cls: 'left-0 top-1/2 h-9 w-3.5 rounded-full cursor-ew-resize' },
  { id: 'e', cls: 'left-full top-1/2 h-9 w-3.5 rounded-full cursor-ew-resize' },
]

const pct = (v: number, total: number) => `${(v / total) * 100}%`

export default function BannerEditor({
  src,
  width,
  height,
  box,
  onBoxChange,
  qr,
  qrStyle,
  logoImg,
  behind,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Drag | null>(null)

  // Redraw only when the code or its style changes. The canvas is scaled by
  // CSS, so it follows the box for free when it is moved or resized.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !qr) return
    const dim = previewCanvasSize(qr)
    canvas.width = dim
    canvas.height = dim
    const ctx = canvas.getContext('2d')
    if (ctx) drawQr(ctx, qr, 0, 0, dim, qrStyle, logoImg)
  }, [qr, qrStyle, logoImg])

  /** Pointer position in ORIGINAL banner pixels. */
  const toBanner = (e: { clientX: number; clientY: number }): Point => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    }
  }

  const begin = (mode: Drag['mode']) => (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, start: toBanner(e), origin: box }
  }

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const p = toBanner(e)
    if (d.mode === 'move') {
      onBoxChange(moveRect(d.origin, p.x - d.start.x, p.y - d.start.y, width, height))
    } else {
      // Hold Shift while dragging a corner to keep the box's proportions.
      onBoxChange(resizeRect(d.origin, d.mode, p, width, height, e.shiftKey))
    }
  }

  const end = () => {
    drag.current = null
  }

  // Arrow keys nudge by one on-screen pixel (Shift = 10) for precise placement.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const dir = keys[e.key]
    if (!dir) return
    e.preventDefault()
    const rect = wrapRef.current!.getBoundingClientRect()
    const step = Math.max(1, Math.round(width / rect.width)) * (e.shiftKey ? 10 : 1)
    onBoxChange(moveRect(box, dir[0] * step, dir[1] * step, width, height))
  }

  const q = qrBox(box)
  const nonSquare = Math.abs(box.w - box.h) > 0.5

  return (
    <div
      ref={wrapRef}
      className="relative isolate inline-block max-w-full select-none leading-[0] shadow-2xl shadow-black/60"
    >
      <img
        src={src}
        alt="Uploaded banner"
        draggable={false}
        className="relative block h-auto max-h-[75vh] w-auto max-w-full"
        style={{ aspectRatio: `${width} / ${height}`, zIndex: behind ? 1 : 0 }}
      />

      {/* One QR canvas (always square, centred in the box), above or below the banner. */}
      {qr && (
        <canvas
          ref={canvasRef}
          aria-hidden
          data-testid="qr-canvas"
          className="pointer-events-none absolute"
          style={{
            left: pct(q.x, width),
            top: pct(q.y, height),
            width: pct(q.size, width),
            height: pct(q.size, height),
            zIndex: behind ? 0 : 1,
          }}
        />
      )}

      <div
        role="application"
        aria-label="QR target box. Drag to move, use the corner and side handles to resize, arrow keys to nudge."
        tabIndex={0}
        onPointerDown={begin('move')}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        className="absolute cursor-move touch-none outline-none ring-2 ring-buenas-yellow ring-offset-1 ring-offset-black/70 focus-visible:ring-buenas-orange"
        style={{
          left: pct(box.x, width),
          top: pct(box.y, height),
          width: pct(box.w, width),
          height: pct(box.h, height),
          backgroundColor: qr ? undefined : 'rgba(255, 198, 41, 0.18)',
          zIndex: 2,
        }}
      >
        {/* Editing guide only: where the (square) QR will sit inside a stretched box. */}
        {nonSquare && (
          <span
            aria-hidden
            data-testid="qr-guide"
            className="pointer-events-none absolute border border-dashed border-buenas-yellow/80"
            style={{
              left: pct(q.x - box.x, box.w),
              top: pct(q.y - box.y, box.h),
              width: pct(q.size, box.w),
              height: pct(q.size, box.h),
            }}
          />
        )}

        {HANDLES.map((h) => (
          <span
            key={h.id}
            data-handle={h.id}
            onPointerDown={begin(h.id)}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            className={`${BASE} ${h.cls}`}
          />
        ))}
      </div>
    </div>
  )
}

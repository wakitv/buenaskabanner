import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  moveSquare,
  resizeSquare,
  type Corner,
  type Point,
  type Square,
} from '../lib/geometry'
import { drawQr, previewCanvasSize, type QrMatrix } from '../lib/qr'

type Props = {
  src: string
  width: number
  height: number
  square: Square
  onSquareChange: (sq: Square) => void
  qr: QrMatrix | null
}

type Drag = {
  mode: 'move' | Corner
  start: Point
  origin: Square
}

const CORNERS: { id: Corner; cls: string }[] = [
  { id: 'nw', cls: '-left-2.5 -top-2.5 cursor-nwse-resize' },
  { id: 'ne', cls: '-right-2.5 -top-2.5 cursor-nesw-resize' },
  { id: 'sw', cls: '-left-2.5 -bottom-2.5 cursor-nesw-resize' },
  { id: 'se', cls: '-right-2.5 -bottom-2.5 cursor-nwse-resize' },
]

export default function BannerEditor({ src, width, height, square, onSquareChange, qr }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Drag | null>(null)

  // Draw the QR once per code. The canvas is scaled by CSS, so it follows the
  // square for free when it is moved or resized.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !qr) return
    const dim = previewCanvasSize(qr)
    canvas.width = dim
    canvas.height = dim
    const ctx = canvas.getContext('2d')
    if (ctx) drawQr(ctx, qr, 0, 0, dim)
  }, [qr])

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
    drag.current = { mode, start: toBanner(e), origin: square }
  }

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const p = toBanner(e)
    if (d.mode === 'move') {
      onSquareChange(moveSquare(d.origin, p.x - d.start.x, p.y - d.start.y, width, height))
    } else {
      onSquareChange(resizeSquare(d.origin, d.mode, p, width, height))
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
    onSquareChange(moveSquare(square, dir[0] * step, dir[1] * step, width, height))
  }

  return (
    <div
      ref={wrapRef}
      className="relative inline-block max-w-full select-none leading-[0] shadow-2xl shadow-black/60"
    >
      <img
        src={src}
        alt="Uploaded banner"
        draggable={false}
        className="block h-auto max-h-[75vh] w-auto max-w-full"
        style={{ aspectRatio: `${width} / ${height}` }}
      />

      <div
        role="application"
        aria-label="QR target square. Drag to move, use corner handles to resize, arrow keys to nudge."
        tabIndex={0}
        onPointerDown={begin('move')}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        className="absolute cursor-move touch-none outline-none ring-2 ring-buenas-yellow ring-offset-1 ring-offset-black/70 focus-visible:ring-buenas-orange"
        style={{
          left: `${(square.x / width) * 100}%`,
          top: `${(square.y / height) * 100}%`,
          width: `${(square.size / width) * 100}%`,
          height: `${(square.size / height) * 100}%`,
          backgroundColor: qr ? undefined : 'rgba(255, 198, 41, 0.18)',
        }}
      >
        {qr && <canvas ref={canvasRef} className="block h-full w-full" />}

        {CORNERS.map((c) => (
          <span
            key={c.id}
            onPointerDown={begin(c.id)}
            className={`absolute h-5 w-5 touch-none rounded-full border-2 border-black bg-buenas-yellow shadow ${c.cls}`}
          />
        ))}
      </div>
    </div>
  )
}

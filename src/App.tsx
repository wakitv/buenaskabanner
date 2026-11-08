import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Download, ImagePlus, QrCode } from 'lucide-react'
import BannerEditor from './components/BannerEditor'
import { initialSquare, type Square } from './lib/geometry'
import { createQrMatrix, normalizeUrl, totalModules, type QrMatrix } from './lib/qr'
import { DOWNLOAD_NAME, renderFinalBanner, saveBlob } from './lib/exportBanner'

type Banner = {
  url: string
  img: HTMLImageElement
  width: number
  height: number
  name: string
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = url
  })
}

export default function App() {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [square, setSquare] = useState<Square>({ x: 0, y: 0, size: 100 })
  const [urlInput, setUrlInput] = useState('')
  const [qr, setQr] = useState<QrMatrix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const bannerUrlRef = useRef<string | null>(null)

  // Revoke the banner's object URL when the page unmounts.
  useEffect(() => {
    return () => {
      if (bannerUrlRef.current) URL.revokeObjectURL(bannerUrlRef.current)
    }
  }, [])

  const normalizedUrl = useMemo(() => normalizeUrl(urlInput), [urlInput])
  const urlTouched = urlInput.trim().length > 0
  const canGenerate = !!banner && !!normalizedUrl
  const canDownload = !!banner && !!qr && !busy

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Unsupported file. Please upload a PNG, JPG, JPEG or WEBP image.')
      return
    }

    const url = URL.createObjectURL(file)
    try {
      const img = await loadImage(url)
      const width = img.naturalWidth
      const height = img.naturalHeight
      if (!width || !height) throw new Error('decode')

      // Replace the previous banner and free its memory.
      if (bannerUrlRef.current) URL.revokeObjectURL(bannerUrlRef.current)
      bannerUrlRef.current = url

      setBanner({ url, img, width, height, name: file.name })
      setSquare(initialSquare(width, height))
      setError(null)
    } catch {
      URL.revokeObjectURL(url)
      setError('That image could not be read. Please try a different file.')
    }
  }

  function onGenerate(e: FormEvent) {
    e.preventDefault()
    if (!banner) {
      setError('Upload a banner first.')
      return
    }
    if (!normalizedUrl) {
      setError('Enter a valid website URL, for example https://example.com')
      return
    }
    try {
      setQr(createQrMatrix(normalizedUrl))
      setError(null)
    } catch {
      setError('That URL is too long to fit in a QR code. Please use a shorter link.')
    }
  }

  async function onDownload() {
    if (!banner || !qr) return
    setBusy(true)
    try {
      const blob = await renderFinalBanner(banner.img, banner.width, banner.height, square, qr)
      saveBlob(blob, DOWNLOAD_NAME)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // A QR needs ~3+ pixels per module to scan reliably.
  const pxPerModule = qr ? Math.round(square.size) / totalModules(qr) : null
  const tooSmall = pxPerModule !== null && pxPerModule < 3

  return (
    <div className="min-h-screen bg-buenas-black text-white">
      <div className="h-1.5 w-full bg-gradient-to-r from-buenas-red via-buenas-orange to-buenas-yellow" />

      <header className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 pb-2 pt-6 sm:px-6">
        <div>
          <p className="font-display text-3xl leading-none tracking-wide sm:text-4xl">
            <span className="text-buenas-yellow">Wacky</span>
            <span className="text-buenas-orange">Buds</span>
            <span className="mx-2 text-white/60">x</span>
            <span className="text-buenas-red">Buenas</span>
          </p>
        </div>
        <h1 className="font-display text-2xl tracking-widest text-white/90 sm:text-3xl">
          QR Banner Generator
        </h1>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 pb-14 pt-4 sm:px-6">
        {/* Controls */}
        <section className="grid gap-4 rounded-2xl border border-white/10 bg-buenas-panel p-4 sm:p-5 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col justify-end gap-2">
            <span className="text-xs font-semibold tracking-widest text-white/60">
              1 · BANNER
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={onFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-semibold text-buenas-black transition hover:bg-buenas-yellow focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-orange"
            >
              <ImagePlus size={20} />
              {banner ? 'Replace Banner' : 'Upload Banner'}
            </button>
          </div>

          <form onSubmit={onGenerate} className="flex flex-col gap-2">
            <label
              htmlFor="url"
              className="text-xs font-semibold tracking-widest text-white/60"
            >
              2 · ENTER WEBSITE URL
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="url"
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com"
                aria-invalid={urlTouched && !normalizedUrl}
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-buenas-ink px-4 text-base text-white placeholder:text-white/35 focus:border-buenas-orange focus:outline-none focus:ring-2 focus:ring-buenas-orange/40"
              />
              <button
                type="submit"
                disabled={!canGenerate}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-buenas-red to-buenas-orange px-6 font-bold tracking-wide text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-yellow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
              >
                <QrCode size={20} />
                GENERATE QR CODE
              </button>
            </div>
          </form>

          {/* Messages */}
          <div className="space-y-1.5 text-sm lg:col-span-2">
            {error && (
              <p role="alert" className="flex items-start gap-2 text-buenas-orange">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            {!error && !banner && (
              <p className="text-white/55">Upload a banner (PNG, JPG or WEBP) to get started.</p>
            )}
            {!error && banner && urlTouched && !normalizedUrl && (
              <p className="flex items-start gap-2 text-buenas-yellow">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                Enter a valid website URL, for example https://example.com
              </p>
            )}
            {!error && banner && !urlTouched && !qr && (
              <p className="text-white/55">
                Drag the square (and its corner handles) to where the QR code should go, then enter your URL.
              </p>
            )}
            {!error && qr && !tooSmall && (
              <p className="flex items-start gap-2 text-emerald-400">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                QR code placed. Move or resize the square any time; the QR follows it.
              </p>
            )}
            {!error && tooSmall && (
              <p className="flex items-start gap-2 text-buenas-yellow">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                The QR code is very small and may be hard to scan. Make the square bigger.
              </p>
            )}
          </div>
        </section>

        {/* Editor */}
        <section className="rounded-2xl border border-white/10 bg-buenas-panel p-3 sm:p-5">
          {banner ? (
            <div className="space-y-3">
              <div className="flex justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#2a2a30_0%_25%,#202025_0%_50%)] bg-[length:20px_20px] p-2 sm:p-4">
                <BannerEditor
                  src={banner.url}
                  width={banner.width}
                  height={banner.height}
                  square={square}
                  onSquareChange={setSquare}
                  qr={qr}
                />
              </div>
              <p className="text-center text-xs text-white/50">
                {banner.name} · {banner.width} × {banner.height}px · square at{' '}
                {Math.round(square.x)}, {Math.round(square.y)} · {Math.round(square.size)}px
                (arrow keys nudge the selected square)
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[260px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/20 text-white/60 transition hover:border-buenas-orange hover:text-white focus:outline-none focus-visible:border-buenas-orange"
            >
              <ImagePlus size={40} className="text-buenas-orange" />
              <span className="font-display text-2xl tracking-wide">Your banner appears here</span>
              <span className="text-sm">Click to upload a banner</span>
            </button>
          )}
        </section>

        {/* Download */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onDownload}
            disabled={!canDownload}
            className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-buenas-yellow to-buenas-orange px-8 font-display text-2xl tracking-widest text-buenas-black shadow-lg shadow-buenas-orange/20 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none disabled:hover:brightness-100 sm:w-auto sm:min-w-[22rem]"
          >
            <Download size={24} />
            {busy ? 'PREPARING…' : 'DOWNLOAD FINAL BANNER'}
          </button>
          {!qr && (
            <p className="text-xs text-white/45">Generate a QR code to enable the download.</p>
          )}
        </div>
      </main>
    </div>
  )
}

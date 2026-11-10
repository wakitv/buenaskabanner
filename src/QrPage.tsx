import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Download, ImagePlus, QrCode } from 'lucide-react'
import BannerEditor from './components/BannerEditor'
import { initialSquare, type Square } from './lib/geometry'
import {
  DEFAULT_STYLE,
  LOGO_SCALE_MAX,
  LOGO_SCALE_MIN,
  contrastRatio,
  createQrMatrix,
  isInverted,
  normalizeUrl,
  totalModules,
  type QrMatrix,
  type QrShape,
  type QrStyle,
} from './lib/qr'
import { DOWNLOAD_NAME, renderFinalBanner, saveBlob } from './lib/exportBanner'
import logoUrl from './assets/buenas-logo.jpg'

type Banner = {
  url: string
  img: HTMLImageElement
  width: number
  height: number
  name: string
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const SHAPES: { id: QrShape; label: string }[] = [
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'dots', label: 'Dots' },
]

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = url
  })
}

/** A banner chosen in the Library, to be loaded into the QR editor. */
export type IncomingBanner = { url: string; name: string; nonce: number }

export default function QrPage({ incoming }: { incoming: IncomingBanner | null }) {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [square, setSquare] = useState<Square>({ x: 0, y: 0, size: 100 })
  const [urlInput, setUrlInput] = useState('')
  const [qrText, setQrText] = useState<string | null>(null)
  const [qrStyle, setQrStyle] = useState<QrStyle>(DEFAULT_STYLE)
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const bannerUrlRef = useRef<string | null>(null)

  // Load the bundled Buenas logo once.
  useEffect(() => {
    let alive = true
    loadImage(logoUrl)
      .then((img) => alive && setLogoImg(img))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Revoke the banner's object URL when the page unmounts.
  useEffect(() => {
    return () => {
      if (bannerUrlRef.current) URL.revokeObjectURL(bannerUrlRef.current)
    }
  }, [])

  // A banner picked from the Library: fetch it and load it like an upload.
  useEffect(() => {
    if (!incoming) return
    let alive = true
    fetch(incoming.url)
      .then((r) => {
        if (!r.ok) throw new Error('fetch')
        return r.blob()
      })
      .then((blob) => {
        if (!alive) return
        const n = incoming.name.toLowerCase()
        const type = ACCEPTED_TYPES.includes(blob.type)
          ? blob.type
          : n.endsWith('.png')
            ? 'image/png'
            : n.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg'
        return loadBannerFile(new File([blob], incoming.name, { type }))
      })
      .catch(() => {
        if (alive) setError('Could not load that banner from the Library.')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming])

  const normalizedUrl = useMemo(() => normalizeUrl(urlInput), [urlInput])
  const urlTouched = urlInput.trim().length > 0

  // The matrix depends on the logo toggle: a logo needs higher error correction.
  const qrResult = useMemo<{ qr: QrMatrix | null; failed: boolean }>(() => {
    if (!qrText) return { qr: null, failed: false }
    try {
      return { qr: createQrMatrix(qrText, qrStyle.logo), failed: false }
    } catch {
      return { qr: null, failed: true }
    }
  }, [qrText, qrStyle.logo])
  const qr = qrResult.qr

  const canGenerate = !!banner && !!normalizedUrl
  const canDownload = !!banner && !!qr && !busy

  const update = (patch: Partial<QrStyle>) => setQrStyle((s) => ({ ...s, ...patch }))

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (file) void loadBannerFile(file)
  }

  async function loadBannerFile(file: File) {
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
    setQrText(normalizedUrl)
    setError(null)
  }

  async function onDownload() {
    if (!banner || !qr) return
    setBusy(true)
    try {
      // Make sure the logo is ready even if the user is very quick.
      const logo = qrStyle.logo ? (logoImg ?? (await loadImage(logoUrl))) : null
      const blob = await renderFinalBanner(
        banner.img,
        banner.width,
        banner.height,
        square,
        qr,
        qrStyle,
        logo,
      )
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

  const lowContrast = contrastRatio(qrStyle.fg, qrStyle.bg) < 3
  const inverted = isInverted(qrStyle.fg, qrStyle.bg)
  const colorWarning = inverted
    ? 'Light QR on a dark background: many phone scanners cannot read this. Use a dark QR colour on a light background.'
    : lowContrast
      ? 'These colours are too close together. Increase the contrast so the QR scans reliably.'
      : null

  const shownError =
    error ??
    (qrResult.failed
      ? qrStyle.logo
        ? 'That URL is too long for a QR code with a centre logo. Use a shorter link or turn the logo off.'
        : 'That URL is too long to fit in a QR code. Please use a shorter link.'
      : null)

  return (
    <div className="text-white">
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

          {/* Customize */}
          <fieldset className="border-t border-white/10 pt-4 lg:col-span-2">
            <legend className="sr-only">Customize QR code</legend>
            <p className="mb-3 text-xs font-semibold tracking-widest text-white/60">
              3 · CUSTOMIZE QR (OPTIONAL, UPDATES LIVE)
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_auto_auto_1.2fr]">
              {/* Logo */}
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={qrStyle.logo}
                    onChange={(e) => update({ logo: e.target.checked })}
                    className="peer sr-only"
                  />
                  <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/20 transition peer-checked:bg-buenas-orange peer-focus-visible:ring-2 peer-focus-visible:ring-buenas-yellow after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-8 w-8 rounded-md object-cover"
                    draggable={false}
                  />
                  <span className="text-sm font-medium">Buenas logo in center</span>
                </label>
                {qrStyle.logo && (
                  <label className="flex items-center gap-3 text-sm text-white/70">
                    <span className="w-20 shrink-0">
                      Size {Math.round(qrStyle.logoScale * 100)}%
                    </span>
                    <input
                      type="range"
                      min={LOGO_SCALE_MIN * 100}
                      max={LOGO_SCALE_MAX * 100}
                      step={1}
                      value={Math.round(qrStyle.logoScale * 100)}
                      onChange={(e) => update({ logoScale: Number(e.target.value) / 100 })}
                      className="w-full accent-buenas-orange"
                    />
                  </label>
                )}
              </div>

              {/* Colours */}
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="color"
                  value={qrStyle.fg}
                  onChange={(e) => update({ fg: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0.5"
                />
                QR color
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="color"
                  value={qrStyle.bg}
                  onChange={(e) => update({ bg: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0.5"
                />
                Background
              </label>

              {/* Shape */}
              <div role="radiogroup" aria-label="QR style" className="flex gap-1.5">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={qrStyle.shape === s.id}
                    onClick={() => update({ shape: s.id })}
                    className={`h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-yellow ${
                      qrStyle.shape === s.id
                        ? 'bg-buenas-yellow text-buenas-black'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          {/* Messages */}
          <div className="space-y-1.5 text-sm lg:col-span-2">
            {shownError && (
              <p role="alert" className="flex items-start gap-2 text-buenas-orange">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                {shownError}
              </p>
            )}
            {!shownError && colorWarning && (
              <p className="flex items-start gap-2 text-buenas-yellow">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                {colorWarning}
              </p>
            )}
            {!shownError && !banner && (
              <p className="text-white/55">Upload a banner (PNG, JPG or WEBP) to get started.</p>
            )}
            {!shownError && banner && urlTouched && !normalizedUrl && (
              <p className="flex items-start gap-2 text-buenas-yellow">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                Enter a valid website URL, for example https://example.com
              </p>
            )}
            {!shownError && banner && !urlTouched && !qr && (
              <p className="text-white/55">
                Drag the square (and its corner handles) to where the QR code should go, then enter your URL.
              </p>
            )}
            {!shownError && qr && !tooSmall && !colorWarning && (
              <p className="flex items-start gap-2 text-emerald-400">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                QR code placed. Move or resize the square any time; the QR follows it.
              </p>
            )}
            {!shownError && tooSmall && (
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
                  qrStyle={qrStyle}
                  logoImg={logoImg}
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

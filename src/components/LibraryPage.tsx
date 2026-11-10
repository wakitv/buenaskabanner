import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Copy, Download, QrCode, RefreshCw, Search } from 'lucide-react'
import {
  copyText,
  downloadFromUrl,
  extOf,
  fetchLibrary,
  libraryImageUrl,
  slugify,
  type LibraryItem,
} from '../lib/library'

function BannerCard({
  item,
  onUseInQr,
}: {
  item: LibraryItem
  onUseInQr: (item: LibraryItem) => void
}) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const src = libraryImageUrl(item)
  const long = item.caption.length > 180

  async function onCopy() {
    const ok = await copyText(item.caption)
    setCopied(ok ? 'ok' : 'fail')
    setTimeout(() => setCopied(null), 2000)
  }

  async function onDownload() {
    setDownloading(true)
    setFailed(false)
    try {
      await downloadFromUrl(src, `${slugify(item.title)}.${extOf(item)}`)
    } catch {
      setFailed(true)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <article className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-buenas-panel">
      <img
        src={src}
        alt={item.title}
        loading="lazy"
        draggable={false}
        style={item.width && item.height ? { aspectRatio: `${item.width} / ${item.height}` } : undefined}
        className="block h-auto w-full bg-black/30"
      />
      <div className="space-y-3 p-4">
        <h3 className="font-display text-2xl leading-tight tracking-wide">{item.title}</h3>

        {item.caption && (
          <div>
            <p
              className={`whitespace-pre-wrap break-words text-sm text-white/75 ${
                expanded ? '' : 'line-clamp-4'
              }`}
            >
              {item.caption}
            </p>
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-xs font-semibold text-buenas-yellow hover:underline"
              >
                {expanded ? 'Show less' : 'Show full caption'}
              </button>
            )}
          </div>
        )}

        {item.tags.length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                #{t}
              </span>
            ))}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCopy}
            disabled={!item.caption}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-buenas-red to-buenas-orange text-sm font-bold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-yellow disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied === 'ok' ? <Check size={18} /> : <Copy size={18} />}
            {copied === 'ok' ? 'Copied!' : copied === 'fail' ? 'Copy failed' : 'Copy Caption'}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-buenas-yellow text-sm font-bold text-buenas-black transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
          >
            <Download size={18} />
            {downloading ? 'Saving…' : 'Download'}
          </button>
        </div>
        {failed && (
          <p role="alert" className="text-xs text-buenas-orange">
            Download failed. Please try again.
          </p>
        )}
        <button
          type="button"
          onClick={() => onUseInQr(item)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-2 text-sm font-semibold text-white/80 transition hover:border-buenas-orange hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-yellow"
        >
          <QrCode size={16} />
          Add QR code to this banner
        </button>
      </div>
    </article>
  )
}

export default function LibraryPage({ onUseInQr }: { onUseInQr: (item: LibraryItem) => void }) {
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setItems(await fetchLibrary())
    } catch {
      setError('Could not load the library. Check your connection and try again.')
      setItems((prev) => prev ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tags = useMemo(
    () => Array.from(new Set((items ?? []).flatMap((i) => i.tags))).sort(),
    [items],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter(
      (i) =>
        (!tag || i.tags.includes(tag)) &&
        (!q || `${i.title} ${i.caption} ${i.tags.join(' ')}`.toLowerCase().includes(q)),
    )
  }, [items, query, tag])

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 pb-14 pt-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <h1 className="font-display text-2xl tracking-widest text-white/90 sm:text-3xl sm:mr-auto">
          Banner Library
        </h1>
        <div className="flex gap-2">
          <label className="relative flex-1 sm:w-72">
            <span className="sr-only">Search banners</span>
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or caption"
              className="h-11 w-full rounded-xl border border-white/15 bg-buenas-ink pl-10 pr-3 text-base text-white placeholder:text-white/35 focus:border-buenas-orange focus:outline-none focus:ring-2 focus:ring-buenas-orange/40"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh library"
            title="Refresh"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-yellow"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
          <button
            type="button"
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
              tag === null ? 'bg-buenas-yellow text-buenas-black' : 'bg-white/10 text-white/75 hover:bg-white/20'
            }`}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                tag === t ? 'bg-buenas-yellow text-buenas-black' : 'bg-white/10 text-white/75 hover:bg-white/20'
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-buenas-orange">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {items === null ? (
        <p className="py-16 text-center text-white/50">Loading banners…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/15 px-6 py-16 text-center">
          <p className="font-display text-2xl tracking-wide text-white/80">No banners yet</p>
          <p className="mt-1 text-sm text-white/50">
            Banners added in the Admin tab will show up here with their captions.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-white/50">No banners match your search.</p>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {filtered.map((item) => (
            <BannerCard key={item.id} item={item} onUseInQr={onUseInQr} />
          ))}
        </div>
      )}
    </main>
  )
}

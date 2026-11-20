import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Pencil, Trash2 } from 'lucide-react'
import { libraryImageUrl, parseTags, type LibraryItem } from '../lib/library'

export type EditPatch = { title: string; caption: string; tags: string[] }

type Props = {
  item: LibraryItem
  /** Any save/delete is running somewhere: disable the buttons. */
  busy: boolean
  /** This banner was saved a moment ago. */
  justSaved: boolean
  onSave: (item: LibraryItem, patch: EditPatch) => Promise<'saved' | 'nochange'>
  onDelete: (item: LibraryItem) => void
}

const TITLE_MAX = 120

const inputCls =
  'h-11 w-full rounded-xl border border-white/15 bg-buenas-ink px-3 text-base text-white placeholder:text-white/35 focus:border-buenas-orange focus:outline-none focus:ring-2 focus:ring-buenas-orange/40'
const labelCls = 'text-xs font-semibold tracking-widest text-white/60'

/** Thumbnail that explains itself while a freshly published image is still deploying. */
function Thumb({ item }: { item: LibraryItem }) {
  const [failed, setFailed] = useState(false)
  const box = 'h-20 w-28 shrink-0 rounded-lg bg-black/30 sm:h-24 sm:w-36'
  if (failed) {
    return (
      <div className={`${box} flex items-center justify-center text-center text-xs text-white/50`}>
        Deploying…
        <br />
        (1–2 min)
      </div>
    )
  }
  return (
    <img
      src={libraryImageUrl(item)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${box} object-cover`}
    />
  )
}

export default function BannerRow({ item, busy, justSaved, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [caption, setCaption] = useState(item.caption)
  const [tagsRaw, setTagsRaw] = useState(item.tags.join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const tags = parseTags(tagsRaw)
  const titleMissing = title.trim() === ''
  const dirty =
    title.trim() !== item.title ||
    caption.trim() !== item.caption ||
    tags.join('\n') !== item.tags.join('\n')

  function startEdit() {
    setTitle(item.title)
    setCaption(item.caption)
    setTagsRaw(item.tags.join(', '))
    setError(null)
    setTouched(false)
    setEditing(true)
  }

  function cancel() {
    if (dirty && !window.confirm('Discard your changes to this banner?')) return
    setEditing(false)
    setError(null)
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setTouched(true)
    if (titleMissing) {
      setError('The title cannot be empty.')
      return
    }
    if (!dirty || saving || busy) return
    setSaving(true)
    setError(null)
    try {
      await onSave(item, { title: title.trim(), caption: caption.trim(), tags })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void submit()
    }
  }

  if (!editing) {
    return (
      <li className="rounded-2xl border border-white/10 bg-buenas-panel p-3 sm:p-4">
        <div className="flex gap-3 sm:gap-4">
          <Thumb item={item} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-semibold">{item.title}</p>
            <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm text-white/60">
              {item.caption || 'No caption'}
            </p>
            {item.tags.length > 0 && (
              <p className="flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                    #{t}
                  </span>
                ))}
              </p>
            )}
            {justSaved && (
              <p role="status" className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 size={14} />
                Saved. The public Library updates in 1–2 minutes.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={startEdit}
              aria-label={`Edit ${item.title}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-yellow"
            >
              <Pencil size={18} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              disabled={busy}
              aria-label={`Delete ${item.title}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-buenas-red/20 text-buenas-red hover:bg-buenas-red/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-yellow disabled:opacity-50"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </li>
    )
  }

  const fid = `edit-${item.id}`
  return (
    <li className="rounded-2xl border border-buenas-orange/50 bg-buenas-panel p-3 sm:p-4">
      <form
        aria-label={`Edit ${item.title}`}
        onSubmit={submit}
        onKeyDown={onKeyDown}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <Thumb item={item} />
          <p className="text-sm text-white/60">
            Editing <b className="text-white/90">{item.title}</b>. The banner image stays the same.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor={`${fid}-title`} className={labelCls}>
            TITLE
          </label>
          <input
            id={`${fid}-title`}
            className={`${inputCls} ${touched && titleMissing ? 'border-buenas-red' : ''}`}
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={touched && titleMissing}
            autoFocus
          />
          {touched && titleMissing && <p className="text-xs text-buenas-orange">A title is required.</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor={`${fid}-caption`} className={labelCls}>
            CAPTION (TEAM COPIES THIS)
          </label>
          <textarea
            id={`${fid}-caption`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={7}
            className="w-full rounded-xl border border-white/15 bg-buenas-ink p-3 text-base text-white placeholder:text-white/35 focus:border-buenas-orange focus:outline-none focus:ring-2 focus:ring-buenas-orange/40"
          />
          <p className="text-right text-xs text-white/40">{caption.length.toLocaleString()} characters</p>
        </div>

        <div className="space-y-1">
          <label htmlFor={`${fid}-tags`} className={labelCls}>
            TAGS (COMMA SEPARATED)
          </label>
          <input
            id={`${fid}-tags`}
            className={inputCls}
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="promo, weekend, wackybuds"
          />
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-white/45">
            {tags.length === 0 ? (
              'No tags'
            ) : (
              <>
                Will be saved as:
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-white/75">
                    #{t}
                  </span>
                ))}
              </>
            )}
          </p>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-buenas-orange">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!dirty || saving || busy}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-buenas-yellow px-5 font-bold text-buenas-black transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="h-11 rounded-xl bg-white/10 px-5 font-semibold text-white/85 hover:bg-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <span className="text-xs text-white/40">
            {dirty ? 'Unsaved changes · Ctrl+Enter to save, Esc to cancel' : 'No changes yet'}
          </span>
        </div>
      </form>
    </li>
  )
}

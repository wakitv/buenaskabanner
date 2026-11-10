import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  KeyRound,
  Loader2,
  Pencil,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import VisitorStats from './VisitorStats'
import {
  commitFiles,
  readLibrary,
  verifyRepo,
  type FileChange,
  type RepoConfig,
} from '../lib/github'
import {
  REPO_LIBRARY_DIR,
  REPO_LIBRARY_JSON,
  blobToBase64,
  libraryImageUrl,
  parseTags,
  prepareImage,
  slugify,
  type LibraryItem,
} from '../lib/library'

const STORAGE_KEY = 'wackybuds-admin'
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

type Saved = Partial<RepoConfig>

function guessRepo(): { owner: string; repo: string } {
  const { hostname, pathname } = window.location
  if (hostname.endsWith('.github.io')) {
    return { owner: hostname.split('.')[0], repo: pathname.split('/')[1] ?? '' }
  }
  return { owner: '', repo: '' }
}

function loadSaved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Saved
  } catch {
    return {}
  }
}

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

const inputCls =
  'h-11 w-full rounded-xl border border-white/15 bg-buenas-ink px-3 text-base text-white placeholder:text-white/35 focus:border-buenas-orange focus:outline-none focus:ring-2 focus:ring-buenas-orange/40'
const labelCls = 'text-xs font-semibold tracking-widest text-white/60'

export default function AdminPage() {
  const saved = useRef(loadSaved()).current
  const guess = useRef(guessRepo()).current

  const [owner, setOwner] = useState(saved.owner ?? guess.owner)
  const [repo, setRepo] = useState(saved.repo ?? guess.repo)
  const [branch, setBranch] = useState(saved.branch ?? 'main')
  const [token, setToken] = useState(saved.token ?? '')
  const [remember, setRemember] = useState(true)

  const [connected, setConnected] = useState(false)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Upload form
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [optimize, setOptimize] = useState(true)

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editTags, setEditTags] = useState('')

  const cfg: RepoConfig = {
    owner: owner.trim(),
    repo: repo.trim(),
    branch: branch.trim() || 'main',
    token: token.trim(),
  }
  const cfgReady = !!(cfg.owner && cfg.repo && cfg.token)

  // Preview URL for the chosen file; always revoked.
  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function persist() {
    try {
      if (remember) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ owner: cfg.owner, repo: cfg.repo, branch: cfg.branch, token: cfg.token }),
        )
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* storage unavailable: the session still works */
    }
  }

  function disconnect() {
    setConnected(false)
    setItems([])
    setToken('')
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const onConnect = (e: FormEvent) => {
    e.preventDefault()
    void run('connect', async () => {
      await verifyRepo(cfg)
      setItems(await readLibrary(cfg))
      persist()
      setConnected(true)
    })
  }

  /**
   * Always re-read library.json from the repo right before committing, so a
   * second admin's changes are never overwritten by a stale list.
   */
  async function mutate(
    message: string,
    change: (fresh: LibraryItem[]) => { next: LibraryItem[]; extra?: FileChange[] },
  ) {
    const fresh = await readLibrary(cfg)
    const { next, extra = [] } = change(fresh)
    await commitFiles(cfg, message, [
      ...extra,
      { path: REPO_LIBRARY_JSON, text: JSON.stringify(next, null, 2) + '\n' },
    ])
    setItems(next)
  }

  function onPickFile(f: File | undefined) {
    if (!f) return
    if (!ACCEPTED.includes(f.type)) {
      setError('Unsupported file. Please choose a PNG, JPG, JPEG or WEBP image.')
      return
    }
    setError(null)
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
  }

  const onPublish = (e: FormEvent) => {
    e.preventDefault()
    if (!file) return setError('Choose a banner image first.')
    if (!title.trim()) return setError('Give the banner a title.')
    void run('publish', async () => {
      const img = await prepareImage(file, optimize)
      const id = `${Date.now().toString(36)}-${slugify(title)}`
      const imagePath = `images/${id}.${img.ext}`
      const entry: LibraryItem = {
        id,
        title: title.trim(),
        caption: caption.trim(),
        tags: parseTags(tagsRaw),
        image: imagePath,
        width: img.width,
        height: img.height,
        createdAt: new Date().toISOString(),
      }
      const base64 = await blobToBase64(img.blob)
      await mutate(`Add banner: ${entry.title}`, (fresh) => ({
        next: [entry, ...fresh],
        extra: [{ path: `${REPO_LIBRARY_DIR}/${imagePath}`, base64 }],
      }))
      setFile(null)
      setTitle('')
      setCaption('')
      setTagsRaw('')
      setNotice(
        'Published! The Library updates after the site redeploys, usually within 1–2 minutes. Check the Actions tab on GitHub if it takes longer.',
      )
    })
  }

  function startEdit(item: LibraryItem) {
    setEditId(item.id)
    setEditTitle(item.title)
    setEditCaption(item.caption)
    setEditTags(item.tags.join(', '))
  }

  const onSaveEdit = (item: LibraryItem) => {
    if (!editTitle.trim()) return setError('The title cannot be empty.')
    void run('edit', async () => {
      await mutate(`Edit banner: ${editTitle.trim()}`, (fresh) => ({
        next: fresh.map((i) =>
          i.id === item.id
            ? { ...i, title: editTitle.trim(), caption: editCaption.trim(), tags: parseTags(editTags) }
            : i,
        ),
      }))
      setEditId(null)
      setNotice('Saved. The Library updates after the site redeploys, usually within 1–2 minutes.')
    })
  }

  const onDelete = (item: LibraryItem) => {
    if (!window.confirm(`Delete "${item.title}"? This removes the banner and its caption.`)) return
    void run('delete', async () => {
      await mutate(`Delete banner: ${item.title}`, (fresh) => ({
        next: fresh.filter((i) => i.id !== item.id),
        extra: [{ path: `${REPO_LIBRARY_DIR}/${item.image}`, remove: true }],
      }))
      setNotice('Deleted. The Library updates after the site redeploys, usually within 1–2 minutes.')
    })
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 pb-14 pt-4 sm:px-6">
      <h1 className="font-display text-2xl tracking-widest text-white/90 sm:text-3xl">
        Admin: Manage Banners
      </h1>

      <VisitorStats />

      {/* Connection */}
      <section className="rounded-2xl border border-white/10 bg-buenas-panel p-4 sm:p-5">
        {connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 size={18} />
              Connected to {cfg.owner}/{cfg.repo} ({cfg.branch})
            </p>
            <button
              type="button"
              onClick={disconnect}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/20"
            >
              Disconnect &amp; forget token
            </button>
          </div>
        ) : (
          <form onSubmit={onConnect} className="space-y-4">
            <p className={labelCls}>CONNECT TO YOUR GITHUB REPOSITORY</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-sm text-white/70">GitHub username</span>
                <input className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)} autoCapitalize="off" spellCheck={false} />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-white/70">Repository name</span>
                <input className={inputCls} value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="off" spellCheck={false} />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-white/70">Branch</span>
                <input className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} autoCapitalize="off" spellCheck={false} />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="flex items-center gap-2 text-sm text-white/70">
                <KeyRound size={16} /> Personal access token
              </span>
              <input
                type="password"
                className={inputCls}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-buenas-orange"
              />
              Remember on this device only
            </label>

            <details className="rounded-xl bg-black/25 p-3 text-sm text-white/70">
              <summary className="cursor-pointer font-semibold text-buenas-yellow">
                How do I get a token?
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>On GitHub: your profile picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li>
                <li>Repository access: choose <b>Only select repositories</b> and pick this repository.</li>
                <li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>
                <li>Generate, copy the token, and paste it above.</li>
              </ol>
              <p className="mt-2 text-white/50">
                The token is only sent to GitHub, never anywhere else. Don&apos;t share it, and use a private browser on shared computers.
              </p>
            </details>

            <button
              type="submit"
              disabled={!cfgReady || busy === 'connect'}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-buenas-red to-buenas-orange px-6 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'connect' && <Loader2 size={18} className="animate-spin" />}
              Connect
            </button>
          </form>
        )}
      </section>

      {(error || notice) && (
        <div className="space-y-1.5 text-sm">
          {error && (
            <p role="alert" className="flex items-start gap-2 text-buenas-orange">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="flex items-start gap-2 text-emerald-400">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              {notice}
            </p>
          )}
        </div>
      )}

      {connected && (
        <>
          {/* Upload */}
          <section className="rounded-2xl border border-white/10 bg-buenas-panel p-4 sm:p-5">
            <form onSubmit={onPublish} className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-2">
                <p className={labelCls}>NEW BANNER</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  className="hidden"
                  data-testid="banner-file"
                  onChange={(e) => {
                    onPickFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-[180px] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-white/20 text-white/60 transition hover:border-buenas-orange hover:text-white"
                >
                  {preview ? (
                    <img src={preview} alt="Selected banner preview" className="max-h-72 w-full object-contain" />
                  ) : (
                    <span className="flex flex-col items-center gap-2 p-6">
                      <ImagePlus size={32} className="text-buenas-orange" />
                      Choose banner image
                    </span>
                  )}
                </button>
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={optimize}
                    onChange={(e) => setOptimize(e.target.checked)}
                    className="accent-buenas-orange"
                  />
                  Shrink very large images (recommended, saves repo space)
                </label>
              </div>

              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className={labelCls}>TITLE</span>
                  <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend Promo" />
                </label>
                <label className="block space-y-1">
                  <span className={labelCls}>CAPTION (TEAM COPIES THIS)</span>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={6}
                    placeholder="Write the full post caption, including hashtags and links."
                    className="w-full rounded-xl border border-white/15 bg-buenas-ink p-3 text-base text-white placeholder:text-white/35 focus:border-buenas-orange focus:outline-none focus:ring-2 focus:ring-buenas-orange/40"
                  />
                </label>
                <label className="block space-y-1">
                  <span className={labelCls}>TAGS (OPTIONAL, COMMA SEPARATED)</span>
                  <input className={inputCls} value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="promo, weekend, wackybuds" />
                </label>
                <button
                  type="submit"
                  disabled={!file || !title.trim() || !!busy}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-buenas-yellow to-buenas-orange font-display text-xl tracking-widest text-buenas-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === 'publish' ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
                  {busy === 'publish' ? 'PUBLISHING…' : 'PUBLISH TO LIBRARY'}
                </button>
              </div>
            </form>
          </section>

          {/* Existing */}
          <section className="space-y-3">
            <p className={labelCls}>PUBLISHED BANNERS ({items.length})</p>
            {items.length === 0 && <p className="text-sm text-white/50">Nothing published yet.</p>}
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-2xl border border-white/10 bg-buenas-panel p-3 sm:p-4">
                  {editId === item.id ? (
                    <div className="space-y-3">
                      <input className={inputCls} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="Title" />
                      <textarea
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        rows={5}
                        aria-label="Caption"
                        className="w-full rounded-xl border border-white/15 bg-buenas-ink p-3 text-base text-white focus:border-buenas-orange focus:outline-none focus:ring-2 focus:ring-buenas-orange/40"
                      />
                      <input className={inputCls} value={editTags} onChange={(e) => setEditTags(e.target.value)} aria-label="Tags" />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onSaveEdit(item)}
                          disabled={!!busy}
                          className="rounded-lg bg-buenas-yellow px-4 py-2 text-sm font-bold text-buenas-black disabled:opacity-50"
                        >
                          {busy === 'edit' ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setEditId(null)} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3 sm:gap-4">
                      <Thumb item={item} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{item.title}</p>
                        <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm text-white/60">
                          {item.caption || 'No caption'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          aria-label={`Edit ${item.title}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          disabled={!!busy}
                          aria-label={`Delete ${item.title}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-buenas-red/20 text-buenas-red hover:bg-buenas-red/30 disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

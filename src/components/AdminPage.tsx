import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  KeyRound,
  Loader2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import VisitorStats from './VisitorStats'
import BannerRow, { type EditPatch } from './BannerRow'
import {
  ConflictError,
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
  const [conflict, setConflict] = useState(false)

  // Upload form
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [optimize, setOptimize] = useState(true)

  // Banners saved a moment ago (shows a note on the row)
  const [savedIds, setSavedIds] = useState<string[]>([])

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
      const lib = await readLibrary(cfg)
      setItems(lib.items)
      setConflict(lib.recovered)
      persist()
      setConnected(true)
    })
  }

  /**
   * Safe read-modify-write. library.json is read at the branch's exact latest
   * commit, changed, and committed on top of that same commit. If someone else
   * commits in between, GitHub refuses and we start over with fresh data, so
   * nothing is ever overwritten. Returns false (and commits nothing) when the
   * change would not alter anything.
   */
  async function mutate(
    message: string,
    change: (fresh: LibraryItem[]) => { next: LibraryItem[]; extra?: FileChange[] },
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const lib = await readLibrary(cfg)
      const { next, extra = [] } = change(lib.items)
      if (!lib.recovered && extra.length === 0 && JSON.stringify(next) === JSON.stringify(lib.items)) {
        setItems(lib.items)
        return false
      }
      try {
        await commitFiles(
          cfg,
          message,
          [...extra, { path: REPO_LIBRARY_JSON, text: JSON.stringify(next, null, 2) + '\n' }],
          lib.headSha,
        )
      } catch (e) {
        if (e instanceof ConflictError) {
          if (attempt < 2) continue
          throw new Error('The repository kept changing while saving. Please try again in a moment.')
        }
        throw e
      }
      setItems(next)
      setConflict(false) // the file we just wrote is clean
      return true
    }
    return false
  }

  const onRepair = () =>
    void run('repair', async () => {
      await mutate('Repair library.json (resolve merge conflict)', (fresh) => ({ next: fresh }))
      setNotice('Repaired. library.json is clean again; the site updates after the redeploy (1–2 minutes).')
    })

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

  /** Called by a row's edit form. Errors are thrown so the row can show them next to the form. */
  async function saveEdit(item: LibraryItem, patch: EditPatch): Promise<'saved' | 'nochange'> {
    setBusy('edit')
    setError(null)
    setNotice(null)
    try {
      const changed = await mutate(`Edit banner: ${patch.title}`, (fresh) => {
        if (!fresh.some((i) => i.id === item.id)) {
          throw new Error(
            'This banner no longer exists in the repository (it may have been deleted). Press "Reload list".',
          )
        }
        return { next: fresh.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) }
      })
      if (changed) {
        setSavedIds((ids) => [...ids, item.id])
        window.setTimeout(() => setSavedIds((ids) => ids.filter((x) => x !== item.id)), 8000)
      }
      return changed ? 'saved' : 'nochange'
    } finally {
      setBusy(null)
    }
  }

  const onReload = () =>
    void run('reload', async () => {
      const lib = await readLibrary(cfg)
      setItems(lib.items)
      setConflict(lib.recovered)
      setNotice('List refreshed from GitHub.')
    })

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

      {connected && conflict && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-buenas-yellow/40 bg-buenas-yellow/10 p-4 text-sm">
          <p className="min-w-[16rem] flex-1 text-white/85">
            <b>library.json has a Git merge conflict</b> (lines like <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD</code>).
            Your banners were recovered. Press Repair to save a clean file, or just publish or edit
            anything and it is fixed automatically.
          </p>
          <button
            type="button"
            onClick={onRepair}
            disabled={!!busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-buenas-yellow px-4 font-bold text-buenas-black disabled:opacity-50"
          >
            {busy === 'repair' && <Loader2 size={16} className="animate-spin" />}
            Repair library.json now
          </button>
        </div>
      )}

      {connected && (
        <>
          <VisitorStats />

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
            <div className="flex items-center justify-between gap-3">
              <p className={labelCls}>PUBLISHED BANNERS ({items.length})</p>
              <button
                type="button"
                onClick={onReload}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20 disabled:opacity-50"
              >
                <RefreshCw size={14} className={busy === 'reload' ? 'animate-spin' : ''} />
                Reload list
              </button>
            </div>
            {items.length === 0 && <p className="text-sm text-white/50">Nothing published yet.</p>}
            <ul className="space-y-3">
              {items.map((item) => (
                <BannerRow
                  key={item.id}
                  item={item}
                  busy={!!busy}
                  justSaved={savedIds.includes(item.id)}
                  onSave={saveEdit}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

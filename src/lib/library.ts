export type LibraryItem = {
  id: string
  title: string
  caption: string
  tags: string[]
  /** Path relative to the library folder, e.g. "images/abc.jpg". */
  image: string
  width: number
  height: number
  createdAt: string
}

/** Repo paths (what gets committed). Vite copies public/ to the site root. */
export const REPO_LIBRARY_DIR = 'public/library'
export const REPO_LIBRARY_JSON = `${REPO_LIBRARY_DIR}/library.json`

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'banner'

export const extOf = (item: LibraryItem) => item.image.split('.').pop() ?? 'jpg'

/** Public URL of a library image on the deployed site. */
export const libraryImageUrl = (item: LibraryItem) =>
  new URL(`library/${item.image}`, document.baseURI).href

export const parseTags = (raw: string): string[] =>
  Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((t) => t.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean),
    ),
  )

/** Defensive parse: ignore anything that does not look like a library entry. */
export function normalizeLibrary(data: unknown): LibraryItem[] {
  if (!Array.isArray(data)) return []
  return data
    .filter(
      (d): d is Record<string, unknown> =>
        !!d && typeof d === 'object' && typeof (d as { id?: unknown }).id === 'string' &&
        typeof (d as { image?: unknown }).image === 'string',
    )
    .map((d) => ({
      id: String(d.id),
      title: typeof d.title === 'string' ? d.title : 'Untitled',
      caption: typeof d.caption === 'string' ? d.caption : '',
      tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === 'string') : [],
      image: String(d.image),
      width: typeof d.width === 'number' ? d.width : 0,
      height: typeof d.height === 'number' ? d.height : 0,
      createdAt: typeof d.createdAt === 'string' ? d.createdAt : '',
    }))
}

/** Load the published library. A missing file simply means an empty library. */
export async function fetchLibrary(): Promise<LibraryItem[]> {
  const url = new URL('library/library.json', document.baseURI)
  url.searchParams.set('t', String(Date.now())) // never show a stale list
  const res = await fetch(url.href, { cache: 'no-store' })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`library ${res.status}`)
  const items = normalizeLibrary(await res.json())
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers / insecure contexts.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

/** Download a same-origin file under a friendly name. */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('download')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(blob)
  })
}

const MAX_SIDE = 2400

export type PreparedImage = { blob: Blob; ext: string; width: number; height: number }

/**
 * Optionally shrink very large images so the repo stays small. Images that are
 * already reasonable are uploaded untouched.
 */
export async function prepareImage(file: File, optimize: boolean): Promise<PreparedImage> {
  const bmp = await createImageBitmap(file)
  const { width, height } = bmp
  const originalExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const original: PreparedImage = { blob: file, ext: originalExt, width, height }

  const needsWork = optimize && (file.size > 1.5 * 1024 * 1024 || Math.max(width, height) > MAX_SIDE)
  if (!needsWork) {
    bmp.close()
    return original
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bmp.close()
    return original
  }
  ctx.fillStyle = '#ffffff' // JPEG has no transparency
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
  if (!blob || (scale === 1 && blob.size >= file.size)) return original
  return { blob, ext: 'jpg', width: w, height: h }
}

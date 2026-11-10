import { REPO_LIBRARY_JSON, parseLibraryText, type LibraryItem } from './library'

export type RepoConfig = {
  owner: string
  repo: string
  branch: string
  token: string
}

export type FileChange =
  | { path: string; base64: string }
  | { path: string; text: string }
  | { path: string; remove: true }

const API = 'https://api.github.com'

class NotFoundError extends Error {}

async function gh<T>(cfg: RepoConfig, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch {
    throw new Error('Could not reach GitHub. Check your internet connection.')
  }
  if (res.status === 401) {
    throw new Error('GitHub rejected the token. Check that it is correct and has not expired.')
  }
  if (res.status === 403) {
    throw new Error(
      'The token is not allowed to do that. It needs "Contents: Read and write" on this repository.',
    )
  }
  if (res.status === 404) throw new NotFoundError('not found')
  if (!res.ok) throw new Error(`GitHub returned an error (${res.status}). Please try again.`)
  return (await res.json()) as T
}

/** Check that the token works and the repo + branch exist. */
export async function verifyRepo(cfg: RepoConfig): Promise<void> {
  try {
    await gh(cfg, '')
    await gh(cfg, `/git/ref/heads/${encodeURIComponent(cfg.branch)}`)
  } catch (e) {
    if (e instanceof NotFoundError) {
      throw new Error('Repository or branch not found. Check the owner, repository name and branch.')
    }
    throw e
  }
}

/**
 * Read library.json straight from the repo (never stale, unlike the live site).
 * `recovered` is true when the file had Git merge-conflict markers; the banners
 * from both sides are kept and the next save writes a clean file.
 */
export async function readLibrary(
  cfg: RepoConfig,
): Promise<{ items: LibraryItem[]; recovered: boolean }> {
  try {
    const file = await gh<{ content: string }>(
      cfg,
      `/contents/${REPO_LIBRARY_JSON}?ref=${encodeURIComponent(cfg.branch)}`,
    )
    const bin = atob(file.content.replace(/\n/g, ''))
    const text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    if (text.trim() === '') return { items: [], recovered: false }
    return parseLibraryText(text)
  } catch (e) {
    if (e instanceof NotFoundError) return { items: [], recovered: false }
    if (e instanceof SyntaxError) {
      throw new Error(
        'public/library/library.json in the repo is damaged and could not be repaired automatically. Open it on GitHub and replace its contents with [] (or fix the JSON), then connect again.',
      )
    }
    throw e
  }
}

/**
 * Commit several file changes as ONE commit (so the site only redeploys once).
 * Uses the Git Data API: blobs -> tree -> commit -> move the branch.
 */
export async function commitFiles(
  cfg: RepoConfig,
  message: string,
  changes: FileChange[],
): Promise<void> {
  const branch = encodeURIComponent(cfg.branch)
  const ref = await gh<{ object: { sha: string } }>(cfg, `/git/ref/heads/${branch}`)
  const headSha = ref.object.sha
  const head = await gh<{ tree: { sha: string } }>(cfg, `/git/commits/${headSha}`)

  const entries: { path: string; mode: string; type: string; sha: string | null }[] = []
  for (const change of changes) {
    if ('remove' in change) {
      entries.push({ path: change.path, mode: '100644', type: 'blob', sha: null })
      continue
    }
    const blob = await gh<{ sha: string }>(cfg, '/git/blobs', {
      method: 'POST',
      body: JSON.stringify(
        'base64' in change
          ? { content: change.base64, encoding: 'base64' }
          : { content: change.text, encoding: 'utf-8' },
      ),
    })
    entries.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha })
  }

  const tree = await gh<{ sha: string }>(cfg, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }),
  })
  const commit = await gh<{ sha: string }>(cfg, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
  })
  await gh(cfg, `/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  })
}

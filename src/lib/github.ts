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

class HttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** The branch moved while we were saving: re-read and try again. */
export class ConflictError extends Error {}

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
      'The token is not allowed to do that (or GitHub is rate limiting). It needs "Contents: Read and write" on this repository.',
    )
  }
  if (res.status === 404) throw new NotFoundError('not found')
  if (!res.ok) {
    throw new HttpError(`GitHub returned an error (${res.status}). Please try again.`, res.status)
  }
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

export type LibraryRead = {
  items: LibraryItem[]
  /** True when the file had Git merge-conflict markers and was repaired in memory. */
  recovered: boolean
  /** The exact commit the data was read from. Commit on top of this one. */
  headSha: string
}

/**
 * Read library.json from the repo at the branch's CURRENT commit. Reading by
 * commit id (not by branch name) means we never get a cached, older copy, so
 * an edit made right after a publish can't drop the new banner.
 */
export async function readLibrary(cfg: RepoConfig): Promise<LibraryRead> {
  const branch = encodeURIComponent(cfg.branch)
  let headSha: string
  try {
    headSha = (await gh<{ object: { sha: string } }>(cfg, `/git/ref/heads/${branch}`)).object.sha
  } catch (e) {
    if (e instanceof NotFoundError) {
      throw new Error('Repository or branch not found. Check the owner, repository name and branch.')
    }
    throw e
  }

  try {
    const file = await gh<{ content: string }>(cfg, `/contents/${REPO_LIBRARY_JSON}?ref=${headSha}`)
    const bin = atob(file.content.replace(/\n/g, ''))
    const text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    if (text.trim() === '') return { items: [], recovered: false, headSha }
    return { ...parseLibraryText(text), headSha }
  } catch (e) {
    if (e instanceof NotFoundError) return { items: [], recovered: false, headSha }
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
 *
 * Pass `baseSha` (the commit the data was read from). If the branch has moved
 * since, GitHub refuses the update and a ConflictError is thrown, so nobody's
 * changes are overwritten.
 */
export async function commitFiles(
  cfg: RepoConfig,
  message: string,
  changes: FileChange[],
  baseSha?: string,
): Promise<void> {
  const branch = encodeURIComponent(cfg.branch)
  let headSha = baseSha
  if (!headSha) {
    const ref = await gh<{ object: { sha: string } }>(cfg, `/git/ref/heads/${branch}`)
    headSha = ref.object.sha
  }
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
  try {
    // Not a forced update: fails if the branch moved, instead of overwriting.
    await gh(cfg, `/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    })
  } catch (e) {
    if (e instanceof HttpError && (e.status === 422 || e.status === 409)) {
      throw new ConflictError('branch moved')
    }
    throw e
  }
}

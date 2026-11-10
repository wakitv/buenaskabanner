import { GOATCOUNTER_CODE } from '../config'

const SKIP_KEY = 'skipgc' // GoatCounter's own "ignore me" flag

type GoatCounter = { count?: (opts: { path: string; title?: string }) => void }
declare global {
  interface Window {
    goatcounter?: GoatCounter
  }
}

export const analyticsEnabled = GOATCOUNTER_CODE !== ''

export function isSkipping(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) !== null
  } catch {
    return false
  }
}

export function setSkipping(on: boolean): void {
  try {
    if (on) localStorage.setItem(SKIP_KEY, 't')
    else localStorage.removeItem(SKIP_KEY)
  } catch {
    /* storage unavailable */
  }
}

let loaded = false

/** Load the GoatCounter script once. Pageviews are sent manually per tab. */
export function initAnalytics(): void {
  if (!analyticsEnabled || loaded) return
  loaded = true
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://gc.zgo.at/count.js'
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`
  s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true })
  document.head.appendChild(s)
}

/** Count a page view once the script is ready (waits up to ~10s). */
export function trackView(path: string, title: string): void {
  if (!analyticsEnabled || isSkipping()) return
  let tries = 0
  const timer = window.setInterval(() => {
    tries++
    if (window.goatcounter?.count) {
      window.clearInterval(timer)
      window.goatcounter.count({ path, title })
    } else if (tries > 100) {
      window.clearInterval(timer) // blocked by an ad blocker: just give up
    }
  }, 100)
}

export type VisitStats = { total: number; library: number; qr: number }

const parse = (v: unknown) => Number(String(v ?? '0').replace(/[^\d]/g, '')) || 0

async function counter(key: string): Promise<number> {
  const res = await fetch(`https://${GOATCOUNTER_CODE}.goatcounter.com/counter/${key}.json`)
  if (res.status === 404) return 0 // nothing counted for this page yet
  if (!res.ok) throw new Error(`counter ${res.status}`)
  return parse((await res.json() as { count?: unknown }).count)
}

/** Needs "Allow adding visitor counts on your website" enabled in GoatCounter. */
export async function fetchStats(): Promise<VisitStats> {
  const [total, library, qr] = await Promise.all([
    counter('TOTAL'),
    counter(encodeURIComponent('/library')),
    counter(encodeURIComponent('/qr')),
  ])
  return { total, library, qr }
}

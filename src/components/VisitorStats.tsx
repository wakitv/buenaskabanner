import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, BarChart3, ExternalLink, RefreshCw } from 'lucide-react'
import { GOATCOUNTER_CODE } from '../config'
import {
  analyticsEnabled,
  fetchStats,
  isSkipping,
  setSkipping,
  type VisitStats,
} from '../lib/analytics'

const nf = new Intl.NumberFormat()

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-black/25 p-4">
      <p className="text-xs font-semibold tracking-widest text-white/55">{label}</p>
      <p className="mt-1 font-display text-4xl leading-none tracking-wide text-buenas-yellow">
        {value === null ? '…' : nf.format(value)}
      </p>
    </div>
  )
}

export default function VisitorStats() {
  const [stats, setStats] = useState<VisitStats | null>(null)
  const [error, setError] = useState(false)
  const [skip, setSkip] = useState(isSkipping)

  const load = useCallback(async () => {
    if (!analyticsEnabled) return
    setError(false)
    try {
      setStats(await fetchStats())
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="rounded-2xl border border-white/10 bg-buenas-panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-white/60">
          <BarChart3 size={16} /> VISITORS
        </p>
        {analyticsEnabled && (
          <div className="flex items-center gap-2">
            <a
              href={`https://${GOATCOUNTER_CODE}.goatcounter.com`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-buenas-yellow hover:underline"
            >
              Full stats <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={() => void load()}
              aria-label="Refresh visitor count"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>

      {analyticsEnabled ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="TOTAL VIEWS" value={stats?.total ?? null} />
            <Stat label="LIBRARY" value={stats?.library ?? null} />
            <Stat label="QR BANNER" value={stats?.qr ?? null} />
          </div>
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-buenas-orange">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              Could not load the count. In GoatCounter, open Settings and turn on &quot;Allow adding
              visitor counts on your website&quot;.
            </p>
          )}
          <p className="text-xs text-white/45">
            Counts page views of the Library and QR Banner tabs (this Admin tab is never counted).
            Numbers can lag by up to a few hours.
          </p>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={skip}
              onChange={(e) => {
                setSkipping(e.target.checked)
                setSkip(e.target.checked)
              }}
              className="accent-buenas-orange"
            />
            Don&apos;t count my own visits on this device
          </label>
        </div>
      ) : (
        <details className="rounded-xl bg-black/25 p-3 text-sm text-white/70" open>
          <summary className="cursor-pointer font-semibold text-buenas-yellow">
            Visitor counter is not set up yet
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Sign up free at <b>goatcounter.com</b> and pick a site code, e.g. <code>wackybuds</code>.
            </li>
            <li>
              In GoatCounter go to <b>Settings</b> and turn on{' '}
              <b>&quot;Allow adding visitor counts on your website&quot;</b>, then save.
            </li>
            <li>
              In this project, open <code>src/config.ts</code>, put your code in{' '}
              <code>SITE_CODE</code> (for example <code>&apos;wackybuds&apos;</code>), commit, and push.
            </li>
            <li>After the site redeploys, the numbers appear here.</li>
          </ol>
        </details>
      )}
    </section>
  )
}

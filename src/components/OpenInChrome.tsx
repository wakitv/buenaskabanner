import { useMemo, useState } from 'react'
import { Check, Chrome, Copy, X } from 'lucide-react'
import { copyText } from '../lib/library'

/** Social apps open links in their own limited browser, where downloads and copying often fail. */
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|LinkedInApp|MicroMessenger|Telegram|Viber|; wv\)/i

type Platform = 'android' | 'ios' | null

function detect(ua: string): Platform {
  const ios = /iPhone|iPad|iPod/i.test(ua)
  const android = /Android/i.test(ua)
  // iOS webviews have no "Safari/" token; real Safari and Chrome (CriOS) do.
  const iosWebview = ios && !/Safari\//i.test(ua)
  const inApp = IN_APP.test(ua) || iosWebview
  if (!inApp) return null
  if (android) return 'android'
  if (ios) return 'ios'
  return null
}

export function chromeLink(platform: Exclude<Platform, null>, href: string): string {
  const u = new URL(href)
  if (platform === 'ios') {
    // Chrome for iOS URL scheme (https -> googlechromes).
    return href.replace(/^https?:/i, u.protocol === 'https:' ? 'googlechromes:' : 'googlechrome:')
  }
  const fallback = encodeURIComponent(href)
  return (
    `intent://${u.host}${u.pathname}${u.search}` +
    `#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;` +
    `S.browser_fallback_url=${fallback};end`
  )
}

export default function OpenInChrome() {
  const platform = useMemo(() => detect(navigator.userAgent), [])
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!platform || dismissed) return null

  async function onCopy() {
    if (await copyText(window.location.href.split('#')[0])) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      role="region"
      aria-label="Open in Chrome"
      className="border-b border-buenas-yellow/30 bg-buenas-yellow/10 px-4 py-3 sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <p className="min-w-[14rem] flex-1 text-sm text-white/85">
          <b>For best results, open this in Chrome.</b> Downloading banners and copying captions may not work inside this app.
        </p>
        <a
          href={chromeLink(platform, window.location.href)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-buenas-yellow px-4 text-sm font-bold text-buenas-black hover:brightness-110"
        >
          <Chrome size={18} />
          Open in Chrome
        </a>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white/85 hover:bg-white/20"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/60 hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

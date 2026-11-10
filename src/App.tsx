import { useEffect, useState } from 'react'
import { Images, QrCode, Settings2 } from 'lucide-react'
import QrPage, { type IncomingBanner } from './QrPage'
import LibraryPage from './components/LibraryPage'
import AdminPage from './components/AdminPage'
import OpenInChrome from './components/OpenInChrome'
import { extOf, libraryImageUrl, slugify, type LibraryItem } from './lib/library'

type Route = 'library' | 'qr' | 'admin'

function parseRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === 'qr' || h === 'admin' ? h : 'library'
}

const TABS: { id: Route; label: string; icon: typeof Images }[] = [
  { id: 'library', label: 'Library', icon: Images },
  { id: 'qr', label: 'QR Banner', icon: QrCode },
  { id: 'admin', label: 'Admin', icon: Settings2 },
]

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute)
  const [incoming, setIncoming] = useState<IncomingBanner | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function useInQr(item: LibraryItem) {
    setIncoming({
      url: libraryImageUrl(item),
      name: `${slugify(item.title)}.${extOf(item)}`,
      nonce: Date.now(),
    })
    window.location.hash = '#/qr'
  }

  return (
    <div className="min-h-screen bg-buenas-black text-white">
      <div className="h-1.5 w-full bg-gradient-to-r from-buenas-red via-buenas-orange to-buenas-yellow" />
      <OpenInChrome />

      <header className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pb-2 pt-6 sm:px-6">
        <p className="font-display text-3xl leading-none tracking-wide sm:text-4xl">
          <span className="text-buenas-yellow">Wacky</span>
          <span className="text-buenas-orange">Buds</span>
          <span className="mx-2 text-white/60">x</span>
          <span className="text-buenas-red">Buenas</span>
        </p>

        <nav aria-label="Main" className="flex gap-1 rounded-xl bg-white/5 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#/${id}`}
              aria-current={route === id ? 'page' : undefined}
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-buenas-yellow sm:px-4 ${
                route === id
                  ? 'bg-buenas-yellow text-buenas-black'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* Pages stay mounted so nothing is lost when switching tabs. */}
      <div className={route === 'library' ? '' : 'hidden'}>
        <LibraryPage onUseInQr={useInQr} />
      </div>
      <div className={route === 'qr' ? '' : 'hidden'}>
        <QrPage incoming={incoming} />
      </div>
      <div className={route === 'admin' ? '' : 'hidden'}>
        <AdminPage />
      </div>
    </div>
  )
}

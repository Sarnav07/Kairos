import { useEffect, useRef, useState } from 'react'
import './LandingExperience.css'

type LandingExperienceProps = {
  phase: string
  protocolReady: boolean
  onEnterDesk: () => void
}

let introPlayed = false

const features = [
  {
    no: '01',
    title: 'Sealed first-price allocation',
    body: 'Commit a hash first. Reveal the bid later. The highest valid bid receives the temporary application-fee right.',
    type: 'lifecycle',
  },
  {
    no: '02',
    title: 'Verified & auditable evidence',
    body: 'Commitments, reveals, finalization, refunds, proceeds and eligible swaps stay connected to explorer evidence.',
    type: 'evidence',
  },
  {
    no: '03',
    title: 'Encrypted secret recovery',
    body: 'The bidder can verify, encrypt and recover the exact amount and salt needed before the reveal window closes.',
    type: 'vault',
  },
  {
    no: '04',
    title: 'Value before conviction',
    body: 'Model expected surcharge savings against the bid and gas before committing capital to the auction.',
    type: 'value',
  },
]

export function LandingExperience({ phase, protocolReady, onEnterDesk }: LandingExperienceProps) {
  const [preloading, setPreloading] = useState(!introPlayed)
  const [cookieOpen, setCookieOpen] = useState(true)
  const [navDark, setNavDark] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const cookieRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!preloading) return
    introPlayed = true
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setPreloading(false), reduced ? 450 : 2200)
    return () => window.clearTimeout(timer)
  }, [preloading])

  useEffect(() => {
    const hero = heroRef.current
    const stage = stageRef.current
    const copy = copyRef.current
    const device = deviceRef.current
    if (!hero || !stage || !copy || !device) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.matchMedia('(max-width: 767px)').matches
    if (reduced || mobile) return

    let raf = 0
    const render = () => {
      raf = 0
      const distance = Math.max(1, hero.offsetHeight - window.innerHeight)
      const progress = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / distance))
      const rise = Math.min(1, progress / 0.34)
      const burst = Math.max(0, (progress - 0.34) / 0.66)
      const scale = 0.78 + rise * 0.48 + burst * 0.82
      const y = 47 * (1 - rise)
      const tilt = 17 * (1 - rise)
      const dark = Math.min(1, Math.max(0, (progress - 0.24) / 0.18))
      const channel = Math.round(255 * (1 - dark) + 2 * dark)

      stage.style.backgroundColor = `rgb(${channel}, ${channel}, ${channel})`
      device.style.transform = `translate3d(0, ${y}%, 0) perspective(1600px) rotateX(${tilt}deg) scale(${scale})`
      device.style.opacity = progress > 0.84 ? String(1 - (progress - 0.84) / 0.16) : '1'
      copy.style.opacity = progress < 0.12 ? '1' : String(Math.max(0, 1 - (progress - 0.12) / 0.12))
      copy.style.transform = `translate3d(0, ${Math.min(0, -(progress * 90))}px, 0)`
      if (cookieRef.current) {
        cookieRef.current.style.opacity = progress < 0.13 ? '1' : String(Math.max(0, 1 - (progress - 0.13) / 0.09))
      }
      const overview = document.getElementById('overview')?.getBoundingClientRect()
      const proof = document.getElementById('proof')?.getBoundingClientRect()
      const navOverDarkSection = Boolean(
        (overview && overview.top <= 36 && overview.bottom > 36)
        || (proof && proof.top <= 36 && proof.bottom > 36),
      )
      setNavDark((progress > 0.31 && progress < 0.91) || navOverDarkSection)
    }
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(render)
    }
    render()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <div className="ao-site">
      {preloading && <Preloader />}
      <header className={`ao-nav ${navDark ? 'on-dark' : ''}`}>
        <a className="ao-wordmark" href="#home" aria-label="Kairos home"><KairosMark /><b>KAIROS</b></a>
        <nav aria-label="Primary navigation">
          <a href="#overview">Overview</a>
          <a href="#features">How it works</a>
          <button onClick={onEnterDesk} type="button">Live Desk</button>
          <a href="#proof">Audit</a>
        </nav>
        <div className="ao-nav-actions">
          <span className="ao-band"><i />{protocolReady ? 'WIRING: VERIFIED' : 'RPC: CHECKING'}</span>
          <button className="ao-pill dark" onClick={onEnterDesk} type="button">Launch Desk <span>→</span></button>
        </div>
      </header>

      <main>
        <section id="home" className="ao-hero-runway" ref={heroRef}>
          <div className="ao-hero-stage" ref={stageRef}>
            <div className="ao-hero-copy" ref={copyRef}>
              <h1>One pool earns the right.<br /><span>Every bidder sees the rules.</span></h1>
              <p>Kairos auctions a temporary application-fee waiver, settles it transparently, and leaves LP fees untouched.</p>
            </div>

            <div className="ao-device-wrap">
              <div className="ao-device" ref={deviceRef}>
                <div className="ao-device-lid">
                  <span className="ao-camera" />
                  <div className="ao-device-screen"><AuctionArt phase={phase} protocolReady={protocolReady} /></div>
                </div>
                <div className="ao-device-base"><span /></div>
                {cookieOpen && (
                  <div className="ao-cookie" ref={cookieRef}>
                    <div className="ao-cookie-title"><KairosMark /> <span>Bid secrets stay local</span></div>
                    <p>Kairos encrypts recovery data in your browser. Wallet writes still require your explicit confirmation.</p>
                    <div><button onClick={() => setCookieOpen(false)} type="button">Understood</button><button onClick={() => setCookieOpen(false)} type="button">Dismiss</button></div>
                  </div>
                )}
              </div>
            </div>
            <span className="ao-scroll-cue">SCROLL <i>↓</i></span>
          </div>
        </section>

        <section id="overview" className="ao-overview">
          <div className="ao-container">
            <span className="ao-kicker">Overview</span>
            <h2>Five phases, one right.<br /><span>Every transition is inspectable.</span></h2>
            <p className="ao-lead">A fixed auction schedule moves from sealed commitments to public reveals, deterministic settlement and one temporary fee-right window. The deployer receives proceeds; losing valid reveals can recover their funds.</p>
            <AuctionLoop />
            <div className="ao-overview-meta"><span>5 phases · 1 winner · fixed window</span><span>Commitment → reveal → settlement → activation</span></div>
          </div>
        </section>

        <section id="features" className="ao-features">
          <div className="ao-feature-heading ao-container">
            <div><span className="ao-kicker">Features</span><h2>Our Features</h2></div>
            <div><p>Kairos turns a protocol mechanism into a bidder-ready product: clear economics before bidding, recoverable secrets during the auction, and verifiable evidence after settlement.</p><span>←&nbsp; SCROLL</span></div>
          </div>
          <div className="ao-feature-track" tabIndex={0} aria-label="Kairos feature carousel">
            {features.map((feature) => <FeatureCard key={feature.no} {...feature} />)}
          </div>
        </section>

        <section id="proof" className="ao-proof">
          <div className="ao-container">
            <span className="ao-kicker">Protocol boundary</span>
            <h2>The right is narrow.<br /><span>The evidence is broad.</span></h2>
            <div className="ao-proof-grid">
              <article><span>01</span><h3>App surcharge only</h3><p>The winner avoids the application surcharge for the configured pool and time window. Native protocol and LP fees remain unchanged.</p></article>
              <article><span>02</span><h3>Wallet-confirmed writes</h3><p>Approvals, commitments, reveals, refunds and proceeds remain explicit wallet transactions on Unichain Sepolia.</p></article>
              <article><span>03</span><h3>Explorer-linked receipts</h3><p>The live desk distinguishes local rehearsal receipts from testnet transactions and links every available hash to the explorer.</p></article>
              <article><span>04</span><h3>Fallback simulator</h3><p>The complete lifecycle remains demonstrable even when a wallet or public RPC is unavailable during judging.</p></article>
            </div>
          </div>
        </section>

        <section className="ao-closing">
          <p>Allocate the temporary advantage<br /><span>without hiding the allocation.</span></p>
          <button className="ao-pill dark" onClick={onEnterDesk} type="button">Launch live desk <span>→</span></button>
        </section>
      </main>

      <footer className="ao-footer">
        <div className="ao-footer-top ao-container">
          <nav><a href="#home">Home</a><a href="#overview">Overview</a><a href="#features">How it works</a><button onClick={onEnterDesk} type="button">Live Desk</button></nav>
          <div><span className="ao-wordmark"><KairosMark /><b>KAIROS</b></span><p>Sealed first-price allocation for a temporary application-fee right.</p></div>
          <button className="ao-pill dark" onClick={onEnterDesk} type="button">Launch Desk <span>→</span></button>
        </div>
        <div className="ao-footer-meta ao-container"><span>ETHOnline 2026 · Uniswap Foundation</span><a href="https://github.com/Sarnav07/Kairos" target="_blank" rel="noreferrer">GitHub ↗</a></div>
        <div className="ao-footer-word" aria-hidden="true">KAIROS</div>
      </footer>
    </div>
  )
}

function Preloader() {
  return (
    <div className="ao-preloader" aria-hidden="true">
      <div className="ao-preloader-word"><KairosMark />{'KAIROS'.split('').map((letter, index) => <span key={`${letter}-${index}`} style={{ animationDelay: `${0.12 + index * 0.06}s` }}>{letter}</span>)}</div>
      <div className="ao-preloader-line"><i /></div>
      <small><i /> CONNECTING TO UNICHAIN SEPOLIA</small>
    </div>
  )
}

function KairosMark() {
  return <span className="ao-mark" aria-hidden="true"><i /><i /></span>
}

function AuctionArt({ phase, protocolReady }: { phase: string; protocolReady: boolean }) {
  const lifecycle = ['COMMIT', 'REVEAL', 'SETTLE', 'ACTIVE']
  return (
    <div className="ao-art">
      <div className="ao-art-bar"><span><i /><i /><i /> KAIROS · PFDA</span><span><b /> {protocolReady ? 'WIRING · VERIFIED' : 'READ-ONLY · CHECKING'}</span></div>
      <div className="ao-art-grid">
        <section>
          <label><em>01</em> AUCTION LIFECYCLE — ONE RIGHT, FIXED WINDOW</label>
          <div className="ao-art-loop">
            <svg viewBox="0 0 500 360" aria-hidden="true"><path d="M250 28 L430 130 L375 315 L125 315 L70 130 Z" /><circle cx="250" cy="180" r="63" /></svg>
            <strong>PFDA<small>{phase}</small></strong>
            {lifecycle.map((item, index) => <span key={item} className={`node n${index + 1}`}><b>{String(index + 1).padStart(2, '0')}</b>{item}<small>{index === 0 ? 'hash only' : index === 1 ? 'bid + salt' : index === 2 ? 'highest valid' : 'fee right'}</small></span>)}
          </div>
        </section>
        <section>
          <label><em>02</em> EXECUTION — AUCTION, TREASURY, POOL</label>
          <div className="ao-art-architecture">
            <div className="wire top" /><div className="wire middle" /><div className="wire bottom" />
            <span className="block auction"><small>ALLOCATION</small><b>Sealed auction</b><em>commit · reveal · settle</em></span>
            <span className="block winner"><small>RIGHT HOLDER</small><b>Winning bidder</b><em>temporary eligibility</em></span>
            <span className="block hook"><small>POLICY</small><b>Fee hook</b><em>app surcharge gate</em></span>
            <span className="block pool"><small>MARKET</small><b>KRA / KRB pool</b><em>LP fees unchanged</em></span>
            <span className="block treasury"><small>PROCEEDS</small><b>Deployer wallet</b><em>collect after settle</em></span>
            <span className="block evidence"><small>AUDIT TAPE</small><b>Events + receipts</b><em>explorer linked</em></span>
          </div>
        </section>
      </div>
      <div className="ao-art-ledger">Event evidence · CommitmentMade → BidRevealed → AuctionFinalized → EligibleSwap</div>
    </div>
  )
}

function AuctionLoop() {
  const items = [
    ['01', 'Schedule', 'terms fixed'], ['02', 'Commit', 'hash only'], ['03', 'Reveal', 'bid + salt'],
    ['04', 'Settle', 'winner selected'], ['05', 'Active', 'right usable'],
  ]
  return (
    <div className="ao-loop">
      <svg viewBox="0 0 1000 440" preserveAspectRatio="none" aria-hidden="true"><path d="M500 20 L880 160 L735 410 L265 410 L120 160 Z" /></svg>
      <div className="ao-loop-center"><span>K</span><b>One fixed<br />allocation loop</b></div>
      {items.map(([no, title, detail], index) => <article key={no} className={`p${index + 1}`}><span>{no}</span><b>{title}</b><small>{detail}</small></article>)}
    </div>
  )
}

function FeatureCard({ no, title, body, type }: { no: string; title: string; body: string; type: string }) {
  return (
    <article className="ao-feature-card">
      <span className="ao-feature-no">{no}</span>
      <div className="ao-feature-copy"><i>◇</i><h3>{title}</h3><p>{body}</p></div>
      <div className={`ao-feature-art ${type}`} aria-hidden="true">
        <div className="ao-mini-window"><span /><span /><span /></div>
        {type === 'lifecycle' && <div className="mini-steps"><i>COMMIT</i><b>→</b><i>REVEAL</i><b>→</b><i>SETTLE</i></div>}
        {type === 'evidence' && <div className="mini-ledger">{['CommitmentMade', 'BidRevealed', 'AuctionFinalized', 'EligibleSwap'].map((x, i) => <span key={x}><i>{`0${i + 1}`}</i>{x}<b>0x{(i + 8).toString(16)}f…{i}a</b></span>)}</div>}
        {type === 'vault' && <div className="mini-vault"><i>⌁</i><b>Secret encrypted</b><span>auction #07 · locally stored</span></div>}
        {type === 'value' && <div className="mini-value"><small>EXPECTED NET VALUE</small><b>+ 317.42</b><span>USDC</span><i /></div>}
      </div>
    </article>
  )
}

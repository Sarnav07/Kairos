import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Address } from 'viem'
import {
  createBidSecret,
  DEMO_AUCTION_ADDRESS,
  DEMO_BIDDER,
  DEMO_CHAIN_ID,
  displayUsdc,
  type BidSecret,
  parseBidSecret,
  simulateTrade,
} from './lib/domain'
import {
  getInjectedProvider,
  getWalletSnapshot,
  isUnichainSepolia,
  liveContracts,
  readProtocolSnapshot,
  shortAddress,
  switchToUnichainSepolia,
  type ProtocolSnapshot,
} from './lib/testnet'

type Phase = 'Schedule' | 'Commit' | 'Reveal' | 'Settle' | 'Active'

type Receipt = {
  id: number
  title: string
  detail: string
  phase: Phase
}

type WalletState = {
  status: 'checking' | 'unavailable' | 'disconnected' | 'wrong-network' | 'connected' | 'error'
  address: Address | null
  chainId: number | null
  message?: string
}

type ProtocolState = {
  status: 'loading' | 'ready' | 'error'
  snapshot: ProtocolSnapshot | null
}

const phases: { name: Phase; description: string }[] = [
  { name: 'Schedule', description: 'Terms fixed' },
  { name: 'Commit', description: 'Hash only' },
  { name: 'Reveal', description: 'Bid + secret' },
  { name: 'Settle', description: 'Winner selected' },
  { name: 'Active', description: 'Waiver usable' },
]

const auction = {
  id: '07',
  token: 'MockUSDC',
  pool: 'KRA / KRB · 0.25%',
  bond: '5.00 USDC',
  minimumBid: '10.00 USDC',
  window: 'No live auction scheduled',
}

function App() {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [bidUsdc, setBidUsdc] = useState('24.50')
  const [secret, setSecret] = useState<BidSecret | null>(null)
  const [notice, setNotice] = useState('Choose a bid, then create a recovery file before you commit.')
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [grossInput, setGrossInput] = useState('10000')
  const [showLiveConfig, setShowLiveConfig] = useState(false)
  const [wallet, setWallet] = useState<WalletState>({ status: 'checking', address: null, chainId: null })
  const [protocol, setProtocol] = useState<ProtocolState>({ status: 'loading', snapshot: null })
  const inputRef = useRef<HTMLInputElement>(null)

  const ordinary = useMemo(
    () => simulateTrade({ grossInputUsdc: Number(grossInput), lpFeePpm: 2_500, surchargePpm: 500 }, false),
    [grossInput],
  )
  const winner = useMemo(
    () => simulateTrade({ grossInputUsdc: Number(grossInput), lpFeePpm: 2_500, surchargePpm: 500 }, true),
    [grossInput],
  )
  const phase = phases[phaseIndex]

  useEffect(() => {
    void refreshProtocol()
    void refreshWallet()
  }, [])

  async function refreshProtocol() {
    setProtocol((current) => ({ ...current, status: 'loading' }))
    try {
      const snapshot = await readProtocolSnapshot()
      setProtocol({ status: 'ready', snapshot })
    } catch {
      setProtocol({ status: 'error', snapshot: null })
    }
  }

  async function refreshWallet(requestAccounts = false) {
    const provider = getInjectedProvider()
    if (!provider) {
      setWallet({ status: 'unavailable', address: null, chainId: null })
      return
    }
    try {
      const snapshot = await getWalletSnapshot(provider, requestAccounts)
      if (!snapshot.address) {
        setWallet({ status: 'disconnected', ...snapshot })
        return
      }
      setWallet({
        status: isUnichainSepolia(snapshot.chainId) ? 'connected' : 'wrong-network',
        ...snapshot,
      })
    } catch {
      setWallet({
        status: 'error',
        address: null,
        chainId: null,
        message: 'Wallet access was declined or is unavailable.',
      })
    }
  }

  async function connectWallet() {
    const provider = getInjectedProvider()
    if (!provider) {
      setWallet({
        status: 'unavailable',
        address: null,
        chainId: null,
        message: 'Install or unlock an EIP-1193 wallet such as MetaMask to connect.',
      })
      return
    }
    await refreshWallet(true)
    const snapshot = await getWalletSnapshot(provider)
    if (snapshot.address && !isUnichainSepolia(snapshot.chainId)) {
      try {
        await switchToUnichainSepolia(provider)
        await refreshWallet()
      } catch {
        setWallet({
          status: 'wrong-network',
          ...snapshot,
          message: 'Switch this wallet to Unichain Sepolia (chain 1301) to use live mode.',
        })
      }
    }
  }

  function prepareSecret() {
    try {
      const nextSecret = createBidSecret({
        chainId: DEMO_CHAIN_ID,
        auctionAddress: DEMO_AUCTION_ADDRESS,
        auctionId: auction.id,
        bidder: DEMO_BIDDER,
        bidUsdc: normalizedBid(bidUsdc),
      })
      setSecret(nextSecret)
      setNotice('Recovery file created. Download it before moving to the commit step.')
    } catch {
      setNotice('Enter a valid USDC amount with no more than six decimal places.')
    }
  }

  function downloadSecret() {
    if (!secret) {
      setNotice('Create a recovery file first.')
      return
    }
    const blob = new Blob([JSON.stringify(secret, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pfda-auction-${secret.auctionId}-bid-secret.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Recovery file downloaded. Store it somewhere private and durable.')
  }

  async function recoverSecret(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const recovered = parseBidSecret(JSON.parse(await file.text()))
      setSecret(recovered)
      setBidUsdc(recovered.bidUsdc)
      setNotice(`Recovered a ${recovered.bidUsdc} USDC secret for auction #${recovered.auctionId}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not read the recovery file.')
    } finally {
      event.target.value = ''
    }
  }

  function runCommit() {
    if (!secret) {
      setNotice('Create and save a recovery file before simulating a commit.')
      return
    }
    if (phaseIndex < 1) setPhaseIndex(1)
    addReceipt('Commit simulated', `Commitment ${shortHash(secret.commitment)} recorded. The bid amount remains hidden.`, 'Commit')
    setNotice('Commit simulated. Keep the recovery file: it is required to reveal the bid.')
  }

  function runReveal() {
    if (!secret) {
      setNotice('Recover the bid secret before revealing.')
      return
    }
    if (phaseIndex < 2) setPhaseIndex(2)
    addReceipt('Reveal simulated', `${secret.bidUsdc} USDC bid plus 5.00 USDC bond escrowed.`, 'Reveal')
    setNotice('Reveal simulated. In a deployed auction, this deposits the bid and bond.')
  }

  function advancePhase() {
    const next = Math.min(phaseIndex + 1, phases.length - 1)
    setPhaseIndex(next)
    const nextPhase = phases[next].name
    if (nextPhase === 'Settle') {
      addReceipt('Settlement simulated', 'Highest valid bid selected; proceeds credit the deployer wallet.', 'Settle')
      addReceipt('Loser refund simulated', 'A revealed losing bidder claims its bid and 5.00 USDC commitment bond.', 'Settle')
    }
    if (nextPhase === 'Active') {
      addReceipt('Eligible swap simulated', 'Winning address calls the executor; the app surcharge is waived for this pool swap.', 'Active')
    }
    setNotice(next === phaseIndex ? 'The demo has reached its active-window state.' : `${nextPhase} phase selected.`)
  }

  function addReceipt(title: string, detail: string, receiptPhase: Phase) {
    setReceipts((current) => [{ id: Date.now(), title, detail, phase: receiptPhase }, ...current])
  }

  return (
    <main className="shell">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="PFDA workstation home">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>PFDA <em>workstation</em></span>
        </a>
        <div className="masthead-right">
          <span className={`network-chip wallet-chip ${wallet.status}`}><i /> {walletLabel(wallet)}</span>
          <button className="connect-button" onClick={connectWallet} type="button">{walletAction(wallet)}</button>
        </div>
      </header>

      <section id="top" className="intro">
        <div>
          <p className="eyebrow">Sealed first-price right</p>
          <h1>Prepare the bid.<br /><span>Protect the secret.</span></h1>
        </div>
        <p className="intro-copy">
          A real Unichain Sepolia runtime beside a guided local auction demo. Read-only wiring is checked against
          the deployed stack; every lifecycle receipt remains explicitly off-chain until the bidder-flow chunk.
        </p>
      </section>

      <section className="ribbon-wrap" aria-label="Auction timeline">
        <div className="ribbon-note"><span className="pulse" /> LOCAL DEMO CLOCK · {phase.name.toUpperCase()}</div>
        <div className="phase-ribbon">
          {phases.map((item, index) => (
            <button
              className={`phase ${index === phaseIndex ? 'is-current' : ''} ${index < phaseIndex ? 'is-past' : ''}`}
              key={item.name}
              onClick={() => setPhaseIndex(index)}
              type="button"
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="status-strip">
        <div><span>Pool</span><strong>{auction.pool}</strong></div>
        <div><span>Bid asset</span><strong>{auction.token} · 6 decimals</strong></div>
        <div><span>Bid floor</span><strong>{auction.minimumBid}</strong></div>
        <div><span>Right window</span><strong>{auction.window}</strong></div>
      </section>

      <section className="runtime-rail" aria-label="Live Unichain Sepolia runtime">
        <div className="runtime-label">
          <span className={protocol.status === 'ready' && protocol.snapshot?.wiringValid ? 'live-dot' : 'live-dot dim'} />
          <div><b>LIVE WIRING</b><small>{protocolLabel(protocol)}</small></div>
        </div>
        <div className="runtime-wallet"><span>Wallet</span><strong>{shortAddress(wallet.address)}</strong><small>{wallet.chainId ? `chain ${wallet.chainId}` : 'read-only is available'}</small></div>
        <div className="runtime-wallet"><span>Pool</span><strong>KRA / KRB</strong><small>{shortHash(liveContracts.poolId)}</small></div>
        <div className="runtime-actions">
          <button className="text-button" onClick={refreshProtocol} type="button">Refresh read-only state</button>
          <a className="text-button" href={explorerUrl(liveContracts.hook)} rel="noreferrer" target="_blank">View hook ↗</a>
        </div>
      </section>

      <section className="work-grid" aria-label="Auction bidder workstation">
        <article className="ticket-panel">
          <div className="panel-topline">
            <p className="eyebrow">Bid ticket</p>
            <span className="serial">PFDA / {auction.id} / {String(phaseIndex + 1).padStart(2, '0')}</span>
          </div>
          <h2>One secret opens one reveal.</h2>
          <p className="panel-copy">Your amount is hashed during commit. The matching salt and amount are needed for reveal.</p>

          <label className="field-label" htmlFor="bid-amount">Your sealed bid</label>
          <div className="amount-field">
            <input
              id="bid-amount"
              inputMode="decimal"
              min="10"
              onChange={(event) => setBidUsdc(event.target.value)}
              step="0.01"
              type="number"
              value={bidUsdc}
            />
            <span>USDC</span>
          </div>
          <p className="field-hint">Minimum {auction.minimumBid}; fixed commitment bond {auction.bond}.</p>

          <div className="secret-card">
            <div className="secret-head">
              <span>RECOVERY FILE</span>
              <b className={secret ? 'ready' : ''}>{secret ? 'Prepared' : 'Required'}</b>
            </div>
            {secret ? (
              <>
                <code>{shortHash(secret.commitment)}</code>
                <p>Bid {secret.bidUsdc} USDC · salt present · auction #{secret.auctionId}</p>
              </>
            ) : (
              <p>No secret exists yet. A commit without its recovery file cannot be revealed.</p>
            )}
          </div>

          <div className="actions two-up">
            <button className="button ink" onClick={prepareSecret} type="button">Create recovery file</button>
            <button className="button ghost" disabled={!secret} onClick={downloadSecret} type="button">Download .json</button>
          </div>
          <div className="recovery-row">
            <input accept="application/json" hidden onChange={recoverSecret} ref={inputRef} type="file" />
            <button className="text-button" onClick={() => inputRef.current?.click()} type="button">Recover an existing file</button>
            <span>Private browser-only demo state</span>
          </div>

          <div className="commit-box">
            <div>
              <span className="step-cap">Next irreversible action</span>
              <strong>Commit hash</strong>
            </div>
            <button className="button coral" onClick={runCommit} type="button">Simulate commit</button>
          </div>
          <p className="notice" role="status">{notice}</p>
        </article>

        <aside className="right-column">
          <article className="command-panel">
            <div className="panel-topline">
              <p className="eyebrow">Demo controls</p>
              <span className="simulation-label">SIMULATED</span>
            </div>
            <h2>Walk the whole lifecycle.</h2>
            <div className="command-list">
              <button className={phaseIndex >= 2 ? 'done' : ''} onClick={runReveal} type="button">
                <span>02</span><div><strong>Reveal the bid</strong><small>Deposits bid + bond in the local receipt ledger.</small></div><b>→</b>
              </button>
              <button className={phaseIndex >= 3 ? 'done' : ''} onClick={advancePhase} type="button">
                <span>03</span><div><strong>Advance demo clock</strong><small>Move through settlement and activation.</small></div><b>→</b>
              </button>
            </div>
            <div className="deployer-note">
              <span>PROCEEDS ROUTE</span>
              <code>deployer wallet</code>
              <p>The winner’s bid and any forfeited non-reveal bonds credit the auction deployer after finalization.</p>
            </div>
          </article>

          <article className="receipt-panel">
            <div className="receipt-title"><p className="eyebrow">Receipt ledger</p><span>{receipts.length} local</span></div>
            {receipts.length === 0 ? (
              <div className="empty-receipts">Actions produce simulated receipts here.<br />Nothing has been sent on-chain.</div>
            ) : (
              <ol>
                {receipts.map((receipt) => (
                  <li key={receipt.id}>
                    <span className="receipt-dot" />
                    <div><strong>{receipt.title}</strong><p>{receipt.detail}</p></div>
                    <time>{receipt.phase}</time>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </aside>
      </section>

      <section className="model-section" aria-labelledby="model-title">
        <div className="model-heading">
          <p className="eyebrow">Scenario runner</p>
          <h2 id="model-title">What the right changes — and what it does not.</h2>
          <p>This is a simplified arithmetic model, not a price quote or execution guarantee. It isolates the app-level surcharge implemented by the hook.</p>
        </div>
        <div className="model-controls">
          <label htmlFor="gross-input">Trade input <input id="gross-input" inputMode="decimal" min="0" onChange={(event) => setGrossInput(event.target.value)} type="number" value={grossInput} /> <span>USDC</span></label>
          <div className="model-rates"><span>LP fee <b>25 bp</b></span><span>App surcharge <b>5 bp</b></span></div>
        </div>
        <div className="comparison">
          <FeeCard caption="Ordinary caller" result={ordinary} tone="ordinary" />
          <div className="waiver-arrow"><span>PFDA<br />right</span><b>−{displayUsdc(ordinary.surchargeUsdc - winner.surchargeUsdc)}</b><small>USDC surcharge</small></div>
          <FeeCard caption="Active PFDA winner" result={winner} tone="winner" />
        </div>
        <p className="model-footnote">Both paths retain the 25 bp LP fee. The model does not include price impact, routing, gas, native protocol fees, or token-transfer edge cases.</p>
      </section>

      <section className="deployment-section">
        <div>
          <p className="eyebrow">Live testnet runtime</p>
          <h2>Addresses are real. Writes are still gated.</h2>
          <p>Read-only calls validate the deployed auction, executor and hook wiring on Unichain Sepolia. Wallet connection is ready, but approvals, commits, reveals and refunds arrive in the next bidder-flow chunk.</p>
        </div>
        <button className="button outline" onClick={() => setShowLiveConfig(!showLiveConfig)} type="button">
          {showLiveConfig ? 'Hide wiring checklist' : 'Show wiring checklist'}
        </button>
        {showLiveConfig && (
          <div className="wiring-checklist">
            <ExplorerAddress label="Auction" address={liveContracts.auction} />
            <ExplorerAddress label="Executor" address={liveContracts.executor} />
            <ExplorerAddress label="Fee hook" address={liveContracts.hook} />
            <ExplorerAddress label="MockUSDC" address={liveContracts.mockUsdc} />
            <ExplorerAddress label="PoolManager" address={liveContracts.poolManager} />
          </div>
        )}
      </section>

      <footer><span>PFDA prototype · Unichain Sepolia read-only + local demo</span><span>Full waiver of the app-level surcharge only</span></footer>
    </main>
  )
}

function FeeCard({ caption, result, tone }: { caption: string; result: ReturnType<typeof simulateTrade>; tone: 'ordinary' | 'winner' }) {
  return (
    <article className={`fee-card ${tone}`}>
      <div className="fee-card-head"><span>{caption}</span><b>{tone === 'winner' ? 'RIGHT ACTIVE' : 'BASELINE'}</b></div>
      <div className="output"><small>Modelled value after LP fee</small><strong>{displayUsdc(result.impliedOutputUsdc)} <em>USDC</em></strong></div>
      <dl>
        <div><dt>Gross input</dt><dd>{displayUsdc(result.grossInputUsdc)}</dd></div>
        <div><dt>App surcharge</dt><dd>{displayUsdc(result.surchargeUsdc)}</dd></div>
        <div><dt>LP fee (25 bp)</dt><dd>{displayUsdc(result.lpFeeUsdc)}</dd></div>
      </dl>
    </article>
  )
}

function normalizedBid(value: string): string {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 10 || !/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error('Invalid bid')
  }
  return value
}

function shortHash(value: string): string {
  return `${value.slice(0, 10)}···${value.slice(-8)}`
}

function explorerUrl(address: Address): string {
  return `https://sepolia.uniscan.xyz/address/${address}`
}

function walletLabel(wallet: WalletState): string {
  if (wallet.status === 'connected') return `Unichain Sepolia · ${shortAddress(wallet.address)}`
  if (wallet.status === 'wrong-network') return 'Wrong network'
  if (wallet.status === 'unavailable') return 'No wallet found'
  if (wallet.status === 'checking') return 'Checking wallet'
  if (wallet.status === 'error') return 'Wallet needs attention'
  return 'Wallet not connected'
}

function walletAction(wallet: WalletState): string {
  if (wallet.status === 'connected') return 'Refresh wallet'
  if (wallet.status === 'wrong-network') return 'Switch to Unichain'
  return 'Connect wallet'
}

function protocolLabel(protocol: ProtocolState): string {
  if (protocol.status === 'loading') return 'Checking auction → executor → hook'
  if (protocol.status === 'error') return 'Read-only RPC check unavailable'
  if (protocol.snapshot?.wiringValid) return `Verified at block ${protocol.snapshot.blockNumber.toString()}`
  return 'Live wiring did not match the committed registry'
}

function ExplorerAddress({ address, label }: { address: Address; label: string }) {
  return <a href={explorerUrl(address)} rel="noreferrer" target="_blank"><b>{label}</b><code>{shortAddress(address)} ↗</code></a>
}

export default App

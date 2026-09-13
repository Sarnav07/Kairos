import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { formatUnits, type Address, type Hex } from 'viem'
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
  addressesMatch,
  approveBidToken,
  collectProceeds,
  commitBid,
  createAuction,
  permitAndCommitBid,
  permitAndRevealBid,
  readBidPreflight,
  readNextAuctionId,
  revealBid,
  withdrawRefund,
  type BidPreflight,
} from './lib/contracts'
import { buildSchedule, parseUsdc, requiredAllowance, type OperatorDurations } from './lib/auction'
import {
  decryptBidSecret,
  encryptBidSecret,
  listVaultRecords,
  saveVaultRecord,
  type EncryptedBidSecret,
} from './lib/vault'
import {
  explorerTransaction,
  getInjectedProvider,
  getWalletSnapshot,
  isUnichainSepolia,
  liveContracts,
  publicClient,
  readProtocolSnapshot,
  shortAddress,
  switchToUnichainSepolia,
  type ProtocolSnapshot,
} from './lib/testnet'
import {
  formatCountdown,
  phaseDeadline,
  readAuctionDashboard,
  rehearsalSteps,
  type AuctionDashboard,
} from './lib/dashboard'
import { calculateAuctionValue, sensitivityEstimates } from './lib/value'
import { LandingExperience } from './components/LandingExperience'

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

type TransactionState = { label: string; hash: Hex } | null

type DashboardState =
  | { status: 'idle' | 'loading' | 'empty' | 'error'; snapshot: null; message?: string }
  | { status: 'ready'; snapshot: AuctionDashboard }

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
  const [screen, setScreen] = useState<'landing' | 'desk'>(() => (
    typeof window !== 'undefined' && window.location.hash === '#desk' ? 'desk' : 'landing'
  ))
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [bidUsdc, setBidUsdc] = useState('24.50')
  const [secret, setSecret] = useState<BidSecret | null>(null)
  const [notice, setNotice] = useState('Choose a bid, then create a recovery file before you commit.')
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [grossInput, setGrossInput] = useState('10000')
  const [showLiveConfig, setShowLiveConfig] = useState(false)
  const [wallet, setWallet] = useState<WalletState>({ status: 'checking', address: null, chainId: null })
  const [protocol, setProtocol] = useState<ProtocolState>({ status: 'loading', snapshot: null })
  const [liveAuctionId, setLiveAuctionId] = useState('1')
  const [bidPreflight, setBidPreflight] = useState<BidPreflight | null>(null)
  const [liveSecret, setLiveSecret] = useState<BidSecret | null>(null)
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultRecords, setVaultRecords] = useState<EncryptedBidSecret[]>(() => (
    typeof localStorage === 'undefined' ? [] : listVaultRecords(localStorage)
  ))
  const [selectedVaultCommitment, setSelectedVaultCommitment] = useState('')
  const [liveNotice, setLiveNotice] = useState('Connect a Unichain Sepolia wallet, then load a scheduled auction.')
  const [transaction, setTransaction] = useState<TransactionState>(null)
  const [operatorDurations, setOperatorDurations] = useState<OperatorDurations>({
    commitDelayMinutes: 5, commitDurationMinutes: 20, revealDurationMinutes: 20,
    activationDelayMinutes: 35, rightDurationMinutes: 30,
  })
  const [operatorBond, setOperatorBond] = useState('1')
  const [operatorMinimumBid, setOperatorMinimumBid] = useState('10')
  const [poolVolumeUsdc, setPoolVolumeUsdc] = useState('500000')
  const [captureSharePercent, setCaptureSharePercent] = useState('30')
  const [surchargeBasisPoints, setSurchargeBasisPoints] = useState('5')
  const [valueBidUsdc, setValueBidUsdc] = useState('50')
  const [gasUsdc, setGasUsdc] = useState('8')
  const [dashboard, setDashboard] = useState<DashboardState>({ status: 'idle', snapshot: null })
  const [dashboardNow, setDashboardNow] = useState(() => Date.now())
  const [guidedDemoRunning, setGuidedDemoRunning] = useState(false)
  const [guidedDemoStatus, setGuidedDemoStatus] = useState('Ready to rehearse all five phases with local receipts.')
  const inputRef = useRef<HTMLInputElement>(null)
  const receiptIdRef = useRef(0)

  const ordinary = useMemo(
    () => simulateTrade({ grossInputUsdc: Number(grossInput), lpFeePpm: 2_500, surchargePpm: 500 }, false),
    [grossInput],
  )
  const winner = useMemo(
    () => simulateTrade({ grossInputUsdc: Number(grossInput), lpFeePpm: 2_500, surchargePpm: 500 }, true),
    [grossInput],
  )
  const auctionValueInput = useMemo(() => ({
    poolVolumeUsdc: inputNumber(poolVolumeUsdc),
    captureSharePercent: inputNumber(captureSharePercent),
    surchargeBasisPoints: inputNumber(surchargeBasisPoints),
    bidUsdc: inputNumber(valueBidUsdc),
    gasUsdc: inputNumber(gasUsdc),
  }), [captureSharePercent, gasUsdc, poolVolumeUsdc, surchargeBasisPoints, valueBidUsdc])
  const auctionValue = useMemo(() => calculateAuctionValue(auctionValueInput), [auctionValueInput])
  const valueSensitivity = useMemo(() => sensitivityEstimates(auctionValueInput), [auctionValueInput])
  const phase = phases[phaseIndex]

  useEffect(() => {
    void refreshProtocol()
    void refreshWallet()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setDashboardNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const connectedAddress = wallet.status === 'connected' ? wallet.address : null
  const isOperator = protocol.snapshot !== null && addressesMatch(connectedAddress, protocol.snapshot.auctionDeployer)

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
    try {
      await refreshWallet(true)
      const snapshot = await getWalletSnapshot(provider)
      if (snapshot.address && !isUnichainSepolia(snapshot.chainId)) {
        await switchToUnichainSepolia(provider)
        await refreshWallet()
      }
    } catch {
      setWallet({
        status: 'wrong-network', address: null, chainId: null,
        message: 'Switch this wallet to Unichain Sepolia (chain 1301) to use live mode.',
      })
    }
  }

  async function loadBidPreflight() {
    if (!connectedAddress) {
      setLiveNotice('Connect a wallet on Unichain Sepolia before loading auction preflight data.')
      return
    }
    try {
      const next = await readBidPreflight(BigInt(liveAuctionId), connectedAddress)
      setBidPreflight(next)
      setLiveNotice(`Auction #${liveAuctionId} loaded. ${phaseLabel(next.phase)} is the current on-chain phase.`)
    } catch {
      setBidPreflight(null)
      setLiveNotice(`Auction #${liveAuctionId} is not available yet. The deployer must schedule it first.`)
    }
  }

  async function loadDashboard(auctionId = liveAuctionId) {
    try {
      const id = BigInt(auctionId)
      setDashboard({ status: 'loading', snapshot: null })
      const nextAuctionId = await readNextAuctionId()
      if (id === 0n || id >= nextAuctionId) {
        setDashboard({ status: 'empty', snapshot: null, message: `Auction #${auctionId} has not been scheduled on-chain.` })
        return
      }
      const snapshot = await readAuctionDashboard(id)
      setDashboard({ status: 'ready', snapshot })
    } catch {
      setDashboard({ status: 'error', snapshot: null, message: 'The public RPC could not load this auction dashboard. Refresh to retry.' })
    }
  }

  async function prepareLiveSecret() {
    if (!connectedAddress || !bidPreflight) {
      setLiveNotice('Load a scheduled auction from a connected wallet before creating its secret.')
      return
    }
    try {
      const bid = parseUsdc(bidUsdc)
      if (bid < bidPreflight.auction.minimumBid) throw new Error('Bid is below this auction’s minimum.')
      const next = createBidSecret({
        chainId: 1301, auctionAddress: liveContracts.auction, auctionId: liveAuctionId,
        bidder: connectedAddress, bidUsdc: normalizedBid(bidUsdc),
      })
      setLiveSecret(next)
      setLiveNotice('Secret prepared for this wallet and auction. Encrypt it before committing.')
    } catch (error) {
      setLiveNotice(error instanceof Error ? error.message : 'Could not prepare this bid secret.')
    }
  }

  async function saveLiveSecret() {
    if (!liveSecret) {
      setLiveNotice('Prepare a live auction secret before encrypting it.')
      return
    }
    try {
      const record = await encryptBidSecret(liveSecret, vaultPassword)
      saveVaultRecord(localStorage, record)
      const records = listVaultRecords(localStorage)
      setVaultRecords(records)
      setSelectedVaultCommitment(record.commitment)
      setVaultPassword('')
      setLiveNotice('Encrypted vault record saved locally. Your password is never stored.')
    } catch (error) {
      setLiveNotice(error instanceof Error ? error.message : 'Could not encrypt this vault record.')
    }
  }

  async function unlockVaultRecord() {
    const record = vaultRecords.find((candidate) => candidate.commitment === selectedVaultCommitment)
    if (!record) {
      setLiveNotice('Choose an encrypted vault record to unlock.')
      return
    }
    try {
      const unlocked = await decryptBidSecret(record, vaultPassword)
      if (unlocked.chainId !== 1301 || !addressesMatch(unlocked.auctionAddress, liveContracts.auction)) {
        throw new Error('This vault secret is not for the configured Unichain Sepolia auction.')
      }
      if (connectedAddress && !addressesMatch(unlocked.bidder, connectedAddress)) {
        throw new Error('This vault secret belongs to a different wallet.')
      }
      setLiveSecret(unlocked)
      setLiveAuctionId(unlocked.auctionId)
      setBidPreflight(null)
      setBidUsdc(unlocked.bidUsdc)
      setVaultPassword('')
      setLiveNotice('Vault record unlocked for this browser session. Reload auction preflight before writing.')
    } catch (error) {
      setLiveNotice(error instanceof Error ? error.message : 'Could not unlock the vault record.')
    }
  }

  async function runBidAction(action: 'approve-commit' | 'commit' | 'permit-commit' | 'approve-reveal' | 'reveal' | 'permit-reveal' | 'refund') {
    const provider = getInjectedProvider()
    if (!provider || !connectedAddress || !bidPreflight) {
      setLiveNotice('Connect a wallet and load auction preflight before sending a transaction.')
      return
    }
    try {
      const auctionId = BigInt(liveAuctionId)
      const bid = liveSecret ? BigInt(liveSecret.bidAmountAtomic) : parseUsdc(bidUsdc)
      if (liveSecret && (
        liveSecret.auctionId !== liveAuctionId
        || liveSecret.chainId !== 1301
        || !addressesMatch(liveSecret.auctionAddress, liveContracts.auction)
        || !addressesMatch(liveSecret.bidder, connectedAddress)
      )) throw new Error('The secret does not match this wallet and configured auction.')
      let hash: Hex
      if (action === 'approve-commit') hash = await approveBidToken(provider, connectedAddress, requiredAllowance('commit', bidPreflight.auction.bond, bid))
      else if (action === 'approve-reveal') hash = await approveBidToken(provider, connectedAddress, requiredAllowance('reveal', bidPreflight.auction.bond, bid))
      else if (action === 'permit-commit') {
        if (!liveSecret) throw new Error('Prepare and encrypt the matching secret before signing a permit.')
        if (bidPreflight.permit.status !== 'available') throw new Error(bidPreflight.permit.reason)
        hash = await permitAndCommitBid(
          provider, connectedAddress, auctionId, liveSecret.commitment, bidPreflight.permit, bidPreflight.auction.bond,
        )
      }
      else if (action === 'commit') {
        if (!liveSecret) throw new Error('Prepare and encrypt the matching secret before committing.')
        hash = await commitBid(provider, connectedAddress, auctionId, liveSecret.commitment)
      } else if (action === 'permit-reveal') {
        if (!liveSecret) throw new Error('Unlock the matching vault secret before signing a permit.')
        if (bidPreflight.permit.status !== 'available') throw new Error(bidPreflight.permit.reason)
        hash = await permitAndRevealBid(
          provider, connectedAddress, auctionId, BigInt(liveSecret.bidAmountAtomic), liveSecret.salt, bidPreflight.permit,
        )
      } else if (action === 'reveal') {
        if (!liveSecret) throw new Error('Unlock the matching vault secret before revealing.')
        hash = await revealBid(provider, connectedAddress, auctionId, BigInt(liveSecret.bidAmountAtomic), liveSecret.salt)
      } else hash = await withdrawRefund(provider, connectedAddress, auctionId)
      setTransaction({ label: action.replace('-', ' '), hash })
      setLiveNotice('Transaction confirmed on Unichain Sepolia.')
      await loadBidPreflight()
      await loadDashboard()
    } catch (error) {
      setLiveNotice(error instanceof Error ? error.message : 'The wallet transaction could not be completed.')
    }
  }

  async function scheduleLiveAuction() {
    const provider = getInjectedProvider()
    if (!provider || !connectedAddress || !isOperator) {
      setLiveNotice('Only the immutable auction deployer on Unichain Sepolia can schedule an auction.')
      return
    }
    try {
      const nextAuctionId = await readNextAuctionId()
      const block = await publicClient.getBlock()
      const schedule = buildSchedule(block.timestamp, operatorDurations)
      const hash = await createAuction(provider, connectedAddress, schedule, parseUsdc(operatorBond), parseUsdc(operatorMinimumBid))
      setLiveAuctionId(nextAuctionId.toString())
      setBidPreflight(null)
      setTransaction({ label: `schedule auction #${nextAuctionId}`, hash })
      setLiveNotice(`Auction #${nextAuctionId} was scheduled. Load it to begin bidder preflight.`)
      await loadDashboard(nextAuctionId.toString())
    } catch (error) {
      setLiveNotice(error instanceof Error ? error.message : 'The auction schedule transaction could not be completed.')
    }
  }

  async function collectLiveProceeds() {
    const provider = getInjectedProvider()
    if (!provider || !connectedAddress || !isOperator) {
      setLiveNotice('Only the immutable auction deployer can collect proceeds.')
      return
    }
    try {
      const hash = await collectProceeds(provider, connectedAddress)
      setTransaction({ label: 'collect proceeds', hash })
      setLiveNotice('Proceeds collection confirmed on Unichain Sepolia.')
      await loadDashboard()
    } catch (error) {
      setLiveNotice(error instanceof Error ? error.message : 'No collectible proceeds are available yet.')
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
    const id = ++receiptIdRef.current
    setReceipts((current) => [{ id, title, detail, phase: receiptPhase }, ...current])
  }

  async function runGuidedDemo() {
    if (guidedDemoRunning) return
    setGuidedDemoRunning(true)
    setReceipts([])
    setPhaseIndex(0)
    setGuidedDemoStatus('01 · Auction terms fixed. Preparing a recoverable sealed bid…')

    try {
      const demoSecret = createBidSecret({
        chainId: DEMO_CHAIN_ID,
        auctionAddress: DEMO_AUCTION_ADDRESS,
        auctionId: auction.id,
        bidder: DEMO_BIDDER,
        bidUsdc: normalizedBid(bidUsdc),
      })
      setSecret(demoSecret)
      setNotice('Guided rehearsal created the recovery data before committing.')
      await demoPause(650)

      setPhaseIndex(1)
      addReceipt('Commit simulated', `Commitment ${shortHash(demoSecret.commitment)} recorded. The bid amount remains hidden.`, 'Commit')
      setGuidedDemoStatus('02 · Commitment recorded. The amount is still hidden.')
      await demoPause(700)

      setPhaseIndex(2)
      addReceipt('Reveal simulated', `${demoSecret.bidUsdc} USDC bid plus 5.00 USDC bond escrowed.`, 'Reveal')
      setGuidedDemoStatus('03 · Bid and salt revealed. Settlement can now verify the commitment.')
      await demoPause(700)

      setPhaseIndex(3)
      addReceipt('Settlement simulated', 'Highest valid bid selected; proceeds credit the deployer wallet.', 'Settle')
      addReceipt('Loser refund simulated', 'A revealed losing bidder claims its bid and 5.00 USDC commitment bond.', 'Settle')
      setGuidedDemoStatus('04 · Highest valid bid won. Proceeds and refunds are accounted for.')
      await demoPause(700)

      setPhaseIndex(4)
      addReceipt('Eligible swap simulated', 'Winning address calls the executor; the app surcharge is waived for this pool swap.', 'Active')
      setNotice('Guided rehearsal complete. The active right waives only the application surcharge.')
      setGuidedDemoStatus('05 · Right active. Five receipts prove the complete local rehearsal.')
    } catch {
      setGuidedDemoStatus('The rehearsal stopped because the bid amount is invalid. Enter at least 10 USDC.')
    } finally {
      setGuidedDemoRunning(false)
    }
  }

  function openDesk() {
    window.history.pushState(null, '', '#desk')
    setScreen('desk')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function openLanding() {
    window.history.pushState(null, '', window.location.pathname)
    setScreen('landing')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  if (screen === 'landing') {
    return (
      <LandingExperience
        phase={phase.name}
        protocolReady={protocol.status === 'ready' && Boolean(protocol.snapshot?.wiringValid)}
        onEnterDesk={openDesk}
      />
    )
  }

  return (
    <main className="shell desk-shell">
      <a className="skip-link" href="#live-desk">Skip to auction controls</a>
      <header className="masthead">
        <button className="brand brand-button" onClick={openLanding} type="button" aria-label="Return to Kairos home">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>KAIROS <em>· LIVE DESK</em></span>
        </button>
        <nav aria-label="Auction desk sections" className="masthead-nav">
          <a href="#lifecycle">Lifecycle</a><a href="#evidence">Evidence</a><a href="#live-desk">Actions</a><a href="#economics">Economics</a>
        </nav>
        <div className="masthead-right">
          <span className={`network-chip wallet-chip ${wallet.status}`}><i /> {walletLabel(wallet)}</span>
          <button className="connect-button" onClick={connectWallet} type="button">{walletAction(wallet)}</button>
        </div>
      </header>

      <section className="desk-showcase" aria-labelledby="desk-showcase-title">
        <div className="desk-showcase-grid" aria-hidden="true" />
        <div className="desk-showcase-copy">
          <span className="desk-showcase-kicker"><i /> LIVE AUCTION WORKSTATION</span>
          <h1 id="desk-showcase-title">Watch the auction<br /><span>settle — live.</span></h1>
          <div className="desk-showcase-rail" aria-label={`Current demonstration phase: ${phase.name}`}>
            {phases.map((item, index) => <i className={index <= phaseIndex ? 'reached' : ''} key={item.name} />)}
          </div>
          <div className="desk-showcase-handoff">
            <span>▼ &nbsp;THE LIVE DESK</span>
            <h2>A complete rehearsal is waiting.</h2>
            <p>Generate a secret, commit, reveal, settle and activate the temporary fee right. Every step writes a labelled local receipt below.</p>
            <button className="desk-demo-button" disabled={guidedDemoRunning} onClick={runGuidedDemo} type="button">
              {guidedDemoRunning ? 'Rehearsal running…' : receipts.length >= 5 && phase.name === 'Active' ? 'Run rehearsal again' : 'Run full rehearsal'} <b>→</b>
            </button>
            <small aria-live="polite">{guidedDemoStatus}</small>
          </div>
        </div>
      </section>

      <section className="desk-stats" aria-label="Auction desk statistics">
        <div><strong>{phase.name}</strong><span>Current phase</span></div>
        <div><strong>#{liveAuctionId}</strong><span>Auction selected</span></div>
        <div><strong>{receipts.length}</strong><span>Local receipts</span></div>
        <div><strong>{protocol.status === 'ready' && protocol.snapshot?.wiringValid ? 'VALID' : 'CHECK'}</strong><span>Contract wiring</span></div>
        <div><strong>{wallet.status === 'connected' ? 'READY' : 'OFF'}</strong><span>Wallet writes</span></div>
        <div><strong>1301</strong><span>Unichain Sepolia</span></div>
      </section>

      <section id="top" className="intro">
        <div>
          <p className="eyebrow">Kairos / Unichain Sepolia / 1301</p>
          <h1>A temporary fee right.<br /><span>One accountable auction.</span></h1>
        </div>
        <p className="intro-copy">
          An operator desk for sealed first-price allocation. Read-only wiring is checked against the deployed stack;
          live actions require an explicit wallet confirmation and local simulator receipts never impersonate on-chain evidence.
        </p>
        <aside className="intro-visual" aria-label="Auction status summary">
          <span className="signal-orbit" aria-hidden="true"><i /><i /><i /></span>
          <div><small>RIGHT STATUS</small><strong>{phase.name}</strong><p>App surcharge only · LP fees remain unchanged</p></div>
        </aside>
      </section>

      <section id="lifecycle" className="ribbon-wrap" aria-label="Auction timeline">
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

      <section id="evidence" className="dashboard-section" aria-label="Live auction dashboard">
        <div className="dashboard-heading">
          <div><p className="eyebrow">Live evidence dashboard</p><h2>The auction tape tells the story.</h2></div>
          <div className="dashboard-load"><label htmlFor="dashboard-auction-id">Auction ID<input id="dashboard-auction-id" inputMode="numeric" min="1" onChange={(event) => { setLiveAuctionId(event.target.value); setBidPreflight(null); setLiveSecret(null); setDashboard({ status: 'idle', snapshot: null }) }} type="number" value={liveAuctionId} /></label><button className="button outline" onClick={() => loadDashboard()} type="button">{dashboard.status === 'loading' ? 'Loading…' : 'Load evidence'}</button></div>
        </div>
        {dashboard.status === 'ready' ? <DashboardView snapshot={dashboard.snapshot} nowSeconds={BigInt(Math.floor(dashboardNow / 1_000))} /> : (
          <div className={`dashboard-empty ${dashboard.status}`}><span className="step-cap">{dashboard.status === 'loading' ? 'Reading Unichain Sepolia' : 'Evidence status'}</span><strong>{dashboard.status === 'loading' ? 'Loading the auction state and recent event window…' : dashboard.message ?? 'Enter an auction ID to load its live state, receipts, and rehearsal evidence.'}</strong><small>This dashboard is read-only. It indexes the most recent on-chain evidence window, not a permanent analytics service.</small></div>
        )}
      </section>

      <section id="live-desk" className="live-control-grid" aria-label="Live bidder and operator controls">
        <article className="live-panel bidder-panel">
          <div className="panel-topline"><p className="eyebrow">Live bidder flow</p><span className="live-tag">WALLET CONFIRMED WRITES</span></div>
          <h2>Commit only what you can reveal.</h2>
          <p className="panel-copy">Each button opens your connected wallet. The app asks for exact allowance amounts; it never stores a wallet key or raw secret in local storage.</p>
          <div className="auction-load-row">
            <label htmlFor="live-auction-id">Auction ID<input id="live-auction-id" inputMode="numeric" min="1" onChange={(event) => { setLiveAuctionId(event.target.value); setBidPreflight(null); setLiveSecret(null); setDashboard({ status: 'idle', snapshot: null }) }} type="number" value={liveAuctionId} /></label>
            <button className="button outline" onClick={loadBidPreflight} type="button">Load live auction</button>
          </div>
          {bidPreflight ? (
            <div className="preflight-grid">
              <span><b>Phase</b>{phaseLabel(bidPreflight.phase)}</span><span><b>Bond</b>{formatUsdc(bidPreflight.auction.bond)}</span><span><b>Minimum</b>{formatUsdc(bidPreflight.auction.minimumBid)}</span><span><b>Balance</b>{formatUsdc(bidPreflight.balance)}</span><span><b>Allowance</b>{formatUsdc(bidPreflight.allowance)}</span>
            </div>
          ) : <p className="empty-live">No auction loaded. Scheduling remains a separate deployer action.</p>}
          {bidPreflight && <div className={`permit-slip ${bidPreflight.permit.status}`}>
            <div><span className="step-cap">Signature authorization</span><strong>{bidPreflight.permit.status === 'available' ? 'ERC-2612 available' : 'Standard approval required'}</strong></div>
            <p>{bidPreflight.permit.status === 'available'
              ? `Sign an exact ${formatUsdc(bidPreflight.auction.bond)} bond or bid authorization. Each signature expires after 15 minutes and is consumed by its matching auction action.`
              : `${bidPreflight.permit.reason} Approval remains the only enabled path for this verified deployment.`}</p>
          </div>}
          <div className="live-secret-row">
            <button className="button ink" disabled={!bidPreflight} onClick={prepareLiveSecret} type="button">Prepare auction secret</button>
            <span>{liveSecret ? `Ready · ${shortHash(liveSecret.commitment)}` : 'Secret not prepared'}</span>
          </div>
          <div className="vault-box">
            <div><span className="step-cap">Encrypted local vault</span><strong>{vaultRecords.length} saved record{vaultRecords.length === 1 ? '' : 's'}</strong></div>
            <label htmlFor="vault-password">Vault password<input autoComplete="new-password" id="vault-password" minLength={12} onChange={(event) => setVaultPassword(event.target.value)} placeholder="12+ characters" type="password" value={vaultPassword} /></label>
            <div className="vault-actions">
              <button className="button ghost" disabled={!liveSecret} onClick={saveLiveSecret} type="button">Encrypt & save</button>
              <select aria-label="Encrypted vault record" onChange={(event) => setSelectedVaultCommitment(event.target.value)} value={selectedVaultCommitment}>
                <option value="">Choose saved record</option>
                {vaultRecords.map((record) => <option key={record.commitment} value={record.commitment}>#{record.auctionId} · {shortHash(record.commitment)}</option>)}
              </select>
              <button className="button ghost" disabled={!selectedVaultCommitment} onClick={unlockVaultRecord} type="button">Unlock selected</button>
            </div>
          </div>
          <div className="write-row">
            <button className="button outline" disabled={!bidPreflight} onClick={() => runBidAction('approve-commit')} type="button">Approve bond</button>
            <button className="button permit" disabled={!bidPreflight || !liveSecret || bidPreflight.phase !== 1 || bidPreflight.permit.status !== 'available'} onClick={() => runBidAction('permit-commit')} type="button">Sign permit &amp; commit</button>
            <button className="button coral" disabled={!bidPreflight || !liveSecret || bidPreflight.phase !== 1} onClick={() => runBidAction('commit')} type="button">Commit hash</button>
            <button className="button outline" disabled={!bidPreflight} onClick={() => runBidAction('approve-reveal')} type="button">Approve bid</button>
            <button className="button permit" disabled={!bidPreflight || !liveSecret || bidPreflight.phase !== 2 || bidPreflight.permit.status !== 'available'} onClick={() => runBidAction('permit-reveal')} type="button">Sign permit &amp; reveal</button>
            <button className="button coral" disabled={!bidPreflight || !liveSecret || bidPreflight.phase !== 2} onClick={() => runBidAction('reveal')} type="button">Reveal bid</button>
            <button className="button outline" disabled={!bidPreflight} onClick={() => runBidAction('refund')} type="button">Claim refund</button>
          </div>
        </article>

        <article className={`live-panel operator-panel ${isOperator ? 'is-operator' : ''}`}>
          <div className="panel-topline"><p className="eyebrow">Deployer controls</p><span className={isOperator ? 'operator-tag ready' : 'operator-tag'}>{isOperator ? 'DEPLOYER VERIFIED' : 'DEPLOYER ONLY'}</span></div>
          <h2>Set the window. Keep it fixed.</h2>
          <p className="panel-copy">Only the immutable auction deployer can create schedules or collect proceeds. The KRA/KRB pool ID is fixed from the verified bootstrap.</p>
          <div className="schedule-fields">
            <NumberField label="Start delay (min)" value={operatorDurations.commitDelayMinutes} onChange={(value) => setOperatorDurations({ ...operatorDurations, commitDelayMinutes: value })} />
            <NumberField label="Commit (min)" value={operatorDurations.commitDurationMinutes} onChange={(value) => setOperatorDurations({ ...operatorDurations, commitDurationMinutes: value })} />
            <NumberField label="Reveal (min)" value={operatorDurations.revealDurationMinutes} onChange={(value) => setOperatorDurations({ ...operatorDurations, revealDurationMinutes: value })} />
            <NumberField label="Activation wait (min)" value={operatorDurations.activationDelayMinutes} onChange={(value) => setOperatorDurations({ ...operatorDurations, activationDelayMinutes: value })} />
            <NumberField label="Right (min)" value={operatorDurations.rightDurationMinutes} onChange={(value) => setOperatorDurations({ ...operatorDurations, rightDurationMinutes: value })} />
          </div>
          <div className="operator-money">
            <label htmlFor="operator-bond">Bond (MockUSDC)<input id="operator-bond" inputMode="decimal" onChange={(event) => setOperatorBond(event.target.value)} value={operatorBond} /></label>
            <label htmlFor="operator-minimum">Minimum bid (MockUSDC)<input id="operator-minimum" inputMode="decimal" onChange={(event) => setOperatorMinimumBid(event.target.value)} value={operatorMinimumBid} /></label>
          </div>
          <p className="operator-pool">Pool ID <code>{shortHash(liveContracts.poolId)}</code> · activation wait must remain at least 30 minutes.</p>
          <div className="operator-actions"><button className="button ink" disabled={!isOperator} onClick={scheduleLiveAuction} type="button">Create fixed auction</button><button className="button ghost" disabled={!isOperator} onClick={collectLiveProceeds} type="button">Collect proceeds</button></div>
          {!isOperator && <p className="operator-lock">Connect the immutable deployer wallet to unlock these controls.</p>}
        </article>
      </section>
      <section className="transaction-strip" aria-live="polite">
        <div><span className="step-cap">Live transaction status</span><strong>{liveNotice}</strong></div>
        {transaction && <a className="button ghost" href={explorerTransaction(transaction.hash)} rel="noreferrer" target="_blank">{transaction.label} ↗</a>}
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

      <section id="economics" className="economics-terminal" aria-labelledby="economics-title">
        <header className="economics-terminal-header">
          <div>
            <p className="eyebrow">Protocol economics</p>
            <h2 id="economics-title">Is the fee right worth its price?</h2>
            <p>Model the application surcharge that the right changes, then test the bid against the trading flow you expect to capture.</p>
          </div>
          <div className="economics-stamp"><span>MODEL STATUS</span><strong>LOCAL ARITHMETIC</strong></div>
        </header>

        <div className="economics-board">
          <aside className="terminal-assumptions" aria-label="Economic assumptions">
            <div className="terminal-panel-head"><span>01 / assumptions</span><small>editable inputs</small></div>
            <div className="terminal-assumption-list">
              <label className="terminal-field" htmlFor="gross-input"><span>Trade input</span><div><input id="gross-input" inputMode="decimal" min="0" onChange={(event) => setGrossInput(event.target.value)} type="number" value={grossInput} /><b>USDC</b></div></label>
              <ValueField label="Pool volume in right window" suffix="USDC" value={poolVolumeUsdc} onChange={setPoolVolumeUsdc} />
              <ValueField label="Your expected capture" suffix="%" value={captureSharePercent} onChange={setCaptureSharePercent} />
              <ValueField label="App surcharge assumption" suffix="bp" value={surchargeBasisPoints} onChange={setSurchargeBasisPoints} />
              <ValueField label="Your sealed bid" suffix="MockUSDC" value={valueBidUsdc} onChange={setValueBidUsdc} />
              <ValueField label="Estimated gas" suffix="USDC" value={gasUsdc} onChange={setGasUsdc} />
            </div>
          </aside>

          <article className="fee-ledger" aria-label="Fee path ledger">
            <div className="terminal-panel-head"><span>02 / fee path ledger</span><small>exact-input model</small></div>
            <div className="ledger-meta"><span>KRA / KRB</span><span>LP fee stays <b>25 bp</b></span></div>
            <div className="ledger-table-wrap">
              <table>
                <thead><tr><th scope="col">Route</th><th scope="col">Input</th><th scope="col">App fee</th><th scope="col">LP fee</th><th scope="col">Modelled value</th></tr></thead>
                <tbody>
                  <tr><th scope="row"><span>Ordinary caller</span><small>baseline route</small></th><td>{displayUsdc(ordinary.grossInputUsdc)}</td><td>{displayUsdc(ordinary.surchargeUsdc)}</td><td>{displayUsdc(ordinary.lpFeeUsdc)}</td><td>{displayUsdc(ordinary.impliedOutputUsdc)}</td></tr>
                  <tr className="ledger-winner"><th scope="row"><span>Active PFDA winner</span><small>right active</small></th><td>{displayUsdc(winner.grossInputUsdc)}</td><td>{displayUsdc(winner.surchargeUsdc)}</td><td>{displayUsdc(winner.lpFeeUsdc)}</td><td>{displayUsdc(winner.impliedOutputUsdc)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="fee-delta"><span>RIGHT DELTA</span><strong>+{displayUsdc(ordinary.surchargeUsdc - winner.surchargeUsdc)} USDC</strong><small>Application surcharge retained by the active winner; LP fee is unchanged.</small></div>
          </article>

          <article className={`terminal-decision ${auctionValue.netValueUsdc >= 0 ? 'positive' : 'negative'}`} aria-label="Bid decision">
            <div className="terminal-panel-head"><span>03 / decision</span><small>{auctionValue.netValueUsdc >= 0 ? 'above threshold' : 'below threshold'}</small></div>
            <span className="decision-label">Modelled net value</span>
            <strong className="decision-value">{auctionValue.netValueUsdc >= 0 ? '+' : '−'}{displayUsdc(Math.abs(auctionValue.netValueUsdc))}<em>USDC</em></strong>
            <p>{auctionValue.netValueUsdc >= 0 ? 'Expected surcharge savings cover the entered bid and gas.' : 'The entered bid and gas exceed expected surcharge savings.'}</p>
            <dl>
              <div><dt>Eligible flow</dt><dd>{displayUsdc(auctionValue.eligibleVolumeUsdc)} USDC</dd></div>
              <div><dt>Surcharge saved</dt><dd>{displayUsdc(auctionValue.surchargeSavingsUsdc)} USDC</dd></div>
              <div><dt>Bid + gas</dt><dd>{displayUsdc(auctionValue.allInCostUsdc)} USDC</dd></div>
              <div><dt>Break-even pool</dt><dd>{auctionValue.breakEvenPoolVolumeUsdc === null ? '—' : `${displayUsdc(auctionValue.breakEvenPoolVolumeUsdc)} USDC`}</dd></div>
            </dl>
            <small className="decision-threshold">{auctionValue.breakEvenEligibleVolumeUsdc === null ? 'A positive surcharge rate and capture share are required.' : `${displayUsdc(auctionValue.breakEvenEligibleVolumeUsdc)} USDC of your eligible flow covers the entered cost.`}</small>
          </article>
        </div>

        <div className="terminal-sensitivity" aria-label="Volume sensitivity">
          <div className="terminal-sensitivity-label"><span>VOLUME SENSITIVITY</span><small>Only pool volume moves; all other assumptions stay fixed.</small></div>
          <div className="terminal-sensitivity-cases">{valueSensitivity.map((item) => <div className={item.estimate.netValueUsdc >= 0 ? 'upside' : 'downside'} key={item.label}><span>{item.label}</span><strong>{item.estimate.netValueUsdc >= 0 ? '+' : '−'}{displayUsdc(Math.abs(item.estimate.netValueUsdc))} USDC</strong><small>{displayUsdc(item.estimate.eligibleVolumeUsdc)} eligible flow</small></div>)}</div>
        </div>
        <p className="terminal-boundary">Arithmetic scenario only—not a quote, forecast, or execution guarantee. Price impact, routing, gas variation, native protocol fees, and token-transfer edge cases are excluded.</p>
      </section>

      <section id="stack" className="deployment-section">
        <div>
          <p className="eyebrow">Live testnet runtime</p>
          <h2>Addresses are real. Writes are wallet-gated.</h2>
          <p>Read-only calls validate the deployed auction, executor and hook wiring on Unichain Sepolia. Live approvals, commits, reveals, refunds and deployer actions stay inactive until the connected wallet meets their preflight checks.</p>
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

      <footer><span>Kairos · Unichain Sepolia auction desk + local rehearsal</span><span>Waives the app surcharge only · not LP or native protocol fees</span></footer>
    </main>
  )
}

function ValueField({ label, onChange, suffix, value }: { label: string; onChange: (value: string) => void; suffix: string; value: string }) {
  const id = `value-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return <label className="value-field" htmlFor={id}><span>{label}</span><div><input id={id} inputMode="decimal" min="0" onChange={(event) => onChange(event.target.value)} type="number" value={value} /><b>{suffix}</b></div></label>
}

function DashboardView({ nowSeconds, snapshot }: { nowSeconds: bigint; snapshot: AuctionDashboard }) {
  const deadline = phaseDeadline(snapshot.phase, snapshot.auction)
  const remaining = deadline.timestamp === null ? null : deadline.timestamp - nowSeconds
  const checklist = rehearsalSteps(snapshot.activity)
  return (
    <div className="dashboard-content">
      <div className="dashboard-state-grid">
        <article className="phase-card">
          <span className="step-cap">Auction #{snapshot.auctionId.toString()} · live phase</span>
          <strong>{phaseLabel(snapshot.phase)}</strong>
          <div>{deadline.label}<b>{remaining === null ? '—' : formatCountdown(remaining)}</b></div>
          {deadline.timestamp !== null && <small>{formatTimestamp(deadline.timestamp)} UTC</small>}
        </article>
        <article className="state-metric"><span>Commitments</span><strong>{snapshot.auction.commitments.toString()}</strong><small>hashes recorded</small></article>
        <article className="state-metric"><span>Reveals</span><strong>{snapshot.auction.reveals.toString()}</strong><small>funded bids</small></article>
        <article className="state-metric"><span>Winner / right</span><strong>{snapshot.auction.winner === '0x0000000000000000000000000000000000000000' ? '—' : shortAddress(snapshot.auction.winner)}</strong><small>{snapshot.auction.cancelled ? 'cancelled' : snapshot.auction.finalized ? 'finalized' : 'not finalized'}</small></article>
        <article className="state-metric"><span>Winning bid</span><strong>{formatUsdc(snapshot.auction.winningBid)}</strong><small>first-price outcome</small></article>
        <article className="state-metric"><span>Treasury credit</span><strong>{formatUsdc(snapshot.treasuryCredit)}</strong><small>awaiting collection</small></article>
        <article className="state-metric"><span>Refunds available</span><strong>{formatUsdc(snapshot.totalRefundable)}</strong><small>pull claims outstanding</small></article>
      </div>
      <div className="evidence-grid">
        <article className="activity-panel">
          <div className="activity-panel-head"><div><p className="eyebrow">Recent on-chain tape</p><h3>{snapshot.activity.length} receipt{snapshot.activity.length === 1 ? '' : 's'}</h3></div><span>blocks {snapshot.windowStartBlock.toString()}–{snapshot.blockNumber.toString()}</span></div>
          {snapshot.activity.length === 0 ? <div className="no-activity">No PFDA activity is recorded for this auction in the current evidence window. Schedule it, then refresh after each confirmed transaction.</div> : <ol className="activity-tape">{snapshot.activity.map((item) => <li className={item.kind} key={`${item.transactionHash}-${item.logIndex}`}><i /><div><strong>{item.title}</strong><p>{item.detail}</p></div><a href={explorerTransaction(item.transactionHash)} rel="noreferrer" target="_blank">block {item.blockNumber.toString()} ↗</a></li>)}</ol>}
        </article>
        <aside className="rehearsal-panel">
          <p className="eyebrow">Two-bidder rehearsal</p><h3>Evidence, not assertions.</h3><ol>{checklist.map((step) => <li className={step.complete ? 'complete' : ''} key={step.label}><i>{step.complete ? '✓' : '○'}</i><div><strong>{step.label}</strong><small>{step.detail}</small></div></li>)}</ol>
          <p className="rehearsal-note">A completed row is derived from visible event receipts. Open each linked transaction before recording the demo.</p>
        </aside>
      </div>
    </div>
  )
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  const id = `operator-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <label htmlFor={id}>{label}
      <input id={id} inputMode="numeric" min="1" onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />
    </label>
  )
}

function phaseLabel(phase: number): string {
  const labels = ['Scheduled', 'Commit open', 'Reveal open', 'Awaiting finalization', 'Pending activation', 'Active', 'Expired', 'Cancelled']
  return labels[phase] ?? 'Unknown phase'
}

function formatUsdc(value: bigint): string {
  return `${formatUnits(value, 6)} MockUSDC`
}

function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1_000).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  })
}

function normalizedBid(value: string): string {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 10 || !/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error('Invalid bid')
  }
  return value
}

function inputNumber(value: string): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function demoPause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
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

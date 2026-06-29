'use client'

import { useAccount, useReadContracts, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { erc20Abi, formatUnits } from 'viem'
import { useOraclePrices } from '@/hooks/use-oracle'
import { AV_CONTRACTS, TOKEN_META } from '@/lib/constants'

import { TokenIcon } from '@/components/TokenIcon'
import { Sparkline } from '@/components/PriceChart'
import { useState, useEffect } from 'react'

// ─── Wallet Button ────────────────────────────────────────────
function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        style={{
          background: 'rgba(0,240,255,0.1)',
          border: '1px solid #00f0ff44',
          color: '#00f0ff',
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      style={{
        background: '#00f0ff',
        border: 'none',
        color: '#0a0a0f',
        padding: '6px 16px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      Connect Wallet
    </button>
  )
}

// ─── Price Card ───────────────────────────────────────────────
function PriceCard({
  symbol,
  price,
  icon,
  sparkColor,
  sparkData,
}: {
  symbol: string
  price: number | null
  icon?: React.ReactNode
  sparkColor: string
  sparkData: number[]
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
      border: '1px solid #1e1e2e',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon || <TokenIcon symbol={symbol} size={36} />}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7' }}>{symbol}</div>
          <div style={{ fontSize: 11, color: '#71717a' }}>{TOKEN_META[symbol.toLowerCase()]?.name || symbol}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#e4e4e7' }}>
          {price ? `$${price.toFixed(4)}` : '—'}
        </div>
        {sparkData.length > 1 && (
          <Sparkline data={sparkData} color={sparkColor} width={70} height={20} />
        )}
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
      border: '1px solid #1e1e2e',
      borderRadius: 12,
      padding: '20px',
    }}>
      <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || '#e4e4e7', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function Home() {
  const { address, isConnected } = useAccount()
  const oracle = useOraclePrices()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Read on-chain balances when connected
  const { data: balances } = useReadContracts({
    contracts: [
      {
        address: AV_CONTRACTS.auToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      },
      {
        address: AV_CONTRACTS.agToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      },
      {
        address: AV_CONTRACTS.auToken,
        abi: erc20Abi,
        functionName: 'totalSupply',
      },
      {
        address: AV_CONTRACTS.agToken,
        abi: erc20Abi,
        functionName: 'totalSupply',
      },
    ],
    query: { enabled: !!address },
  })

  const auBal = balances?.[0]?.result ? formatUnits(balances[0].result as bigint, 18) : null
  const agBal = balances?.[1]?.result ? formatUnits(balances[1].result as bigint, 18) : null
  const auSupply = balances?.[2]?.result ? formatUnits(balances[2].result as bigint, 18) : null
  const agSupply = balances?.[3]?.result ? formatUnits(balances[3].result as bigint, 18) : null

  // Simulated sparkline data (would come from oracle events in production)
  const auSpark = oracle.auPrice ? [oracle.auPrice * 0.997, oracle.auPrice * 0.998, oracle.auPrice * 0.999, oracle.auPrice] : []
  const agSpark = oracle.agPrice ? [oracle.agPrice * 1.001, oracle.agPrice * 1.000, oracle.agPrice * 0.999, oracle.agPrice] : []

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#e4e4e7',
      fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #1e1e2e',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>◈</span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.5px' }}>Artifact</span>
          <span style={{ fontSize: 11, color: '#71717a', background: '#1e1e2e', padding: '2px 8px', borderRadius: 4 }}>Base</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {oracle.loading && (
            <span style={{ fontSize: 11, color: '#f59e0b' }}>� Fetching prices...</span>
          )}
          {oracle.error && (
            <span style={{ fontSize: 11, color: '#ef4444' }}>⚠ {oracle.error}</span>
          )}
          {oracle.lastUpdated && (
            <span style={{ fontSize: 11, color: '#52525b' }}>
              Updated {now ? Math.floor((now.getTime() - oracle.lastUpdated.getTime()) / 1000) : 0}s ago
            </span>
          )}
          <WalletButton />
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>System Dashboard</h1>
          <p style={{ fontSize: 12, color: '#71717a' }}>
            Dual-peg algorithmic monetary system on Base · Block explorer data live
          </p>
        </div>

        {/* Price Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          <PriceCard
            symbol="AU"
            price={oracle.auPrice}
            sparkColor="#ffd700"
            sparkData={auSpark}
            icon={<TokenIcon symbol="AU" size={36} />}
          />
          <PriceCard
            symbol="AG"
            price={oracle.agPrice}
            sparkColor="#a855f7"
            sparkData={agSpark}
            icon={<TokenIcon symbol="AG" size={36} />}
          />
          <PriceCard
            symbol="ETH"
            price={oracle.ethPrice}
            sparkColor="#627eea"
            sparkData={[]}
            icon={<TokenIcon symbol="ETH" size={36} />}
          />
          <PriceCard
            symbol="USDC"
            price={oracle.usdcPrice}
            sparkColor="#2775ca"
            sparkData={[]}
            icon={<TokenIcon symbol="USDC" size={36} />}
          />
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          <StatCard
            label="Total Value Locked"
            value={oracle.tvl ? `$${(oracle.tvl / 1e6).toFixed(2)}M` : '—'}
            sub="Across all reserves"
            accent="#00f0ff"
          />
          <StatCard
            label="Au Supply"
            value={auSupply ? `${(Number(auSupply) / 1e6).toFixed(2)}M` : '—'}
            sub="Total Au minted"
            accent="#ffd700"
          />
          <StatCard
            label="Ag Supply"
            value={agSupply ? `${(Number(agSupply) / 1e6).toFixed(2)}M` : '—'}
            sub="Governance tokens"
            accent="#a855f7"
          />
          <StatCard
            label="Peg Status"
            value={oracle.auPrice && oracle.auPrice > 1.0 ? 'ABOVE' : oracle.auPrice && oracle.auPrice < 1.0 ? 'BELOW' : '—'}
            sub={oracle.auPrice ? `1 Au = $${oracle.auPrice.toFixed(4)}` : 'Awaiting data'}
            accent={oracle.auPrice && oracle.auPrice >= 1.0 ? '#22c55e' : '#f59e0b'}
          />
        </div>

        {/* Wallet Section */}
        {isConnected && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,240,255,0.03) 0%, rgba(0,240,255,0.01) 100%)',
            border: '1px solid #1e1e2e',
            borderRadius: 12,
            padding: '20px',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: '#00f0ff' }}>YOUR POSITION</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TokenIcon symbol="AU" size={24} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{auBal ? Number(auBal).toFixed(2) : '0.00'}</div>
                  <div style={{ fontSize: 10, color: '#71717a' }}>Au Balance</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TokenIcon symbol="AG" size={24} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{agBal ? Number(agBal).toFixed(2) : '0.00'}</div>
                  <div style={{ fontSize: 10, color: '#71717a' }}>Ag Balance</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#52525b', wordBreak: 'break-all' }}>
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            </div>
          </div>
        )}

        {/* Contract Addresses */}
        <div style={{
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid #1e1e2e',
          borderRadius: 12,
          padding: '20px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: '#71717a' }}>CORE CONTRACTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(AV_CONTRACTS).slice(0, 8).map(([name, addr]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#a1a1aa' }}>{name}</span>
                <a
                  href={`https://basescan.org/address/${addr}`}
                  target="_blank"
                  rel="noopener"
                  style={{ color: '#00f0ff', textDecoration: 'none', fontFamily: 'monospace' }}
                >
                  {addr.slice(0, 8)}...{addr.slice(-6)}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

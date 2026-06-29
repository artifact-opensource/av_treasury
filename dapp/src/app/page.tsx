'use client'

import { useAccount } from 'wagmi'
import { usePortfolio } from '@/hooks/use-portfolio'
import { useOraclePrices } from '@/hooks/use-oracle'
import { useAllPrices as useLivePrices } from '@/hooks/use-live-prices'
import { formatTokenAmount, formatUsd } from '@/lib/utils'
import { AV_CONTRACTS } from '@/lib/constants'
import { ArrowRight, Droplets, Coins, Vote, TrendingUp, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { isConnected, address } = useAccount()
  const { auBalance, agBalance, votingPower, auSupply, agSupply, isLoading: portfolioLoading } = usePortfolio()
  const { au, ag, tvl, isLoading: oracleLoading } = useOraclePrices()
  const prices = useLivePrices()
  const liveLoading = !prices.loaded

  // Transform prices into array for display
  const livePrices = [
    { symbol: 'Au', priceUsd: prices.au, valid: prices.au !== null },
    { symbol: 'Ag', priceUsd: prices.ag, valid: prices.ag !== null },
    { symbol: 'ETH', priceUsd: prices.eth, valid: prices.eth !== null },
    { symbol: 'USDC', priceUsd: prices.usdc, valid: prices.usdc !== null },
  ]

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Coins className="h-10 w-10 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">AV Treasury</h1>
          <p className="text-muted-foreground max-w-md">
            The dual-token DAO on Base. Swap Au/Ag, manage Aerodrome liquidity, stake LP NFTs, and govern the protocol.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[
            { label: 'Au Price', value: au?.valid ? `$${Number(au.price) / 1e18}` : '--' },
            { label: 'Ag Price', value: ag?.valid ? `$${Number(ag.price) / 1e18}` : '--' },
            { label: 'TVL', value: tvl?.valid ? formatUsd(Number(tvl.tvl) / 1e18) : '--' },
            { label: 'TWATVL', value: tvl?.valid ? formatUsd(Number(tvl.twatvl) / 1e18) : '--' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</div>
              <div className="text-lg font-semibold mt-1">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const isLoading = portfolioLoading || oracleLoading

  return (
    <div className="space-y-6">
      {/* Stats Row - horizontal scroll on mobile, 4-col grid on desktop */}
      <div className="md:grid md:grid-cols-4 md:gap-4 flex gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
        <StatCard
          label="Au Balance"
          value={isLoading ? '...' : formatTokenAmount(auBalance)}
          sublabel={au?.valid ? `~$${(Number(au.price) / 1e18 * Number(auBalance) / 1e18).toFixed(2)}` : ''}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Ag Balance"
          value={isLoading ? '...' : formatTokenAmount(agBalance)}
          sublabel={ag?.valid ? `~$${(Number(ag.price) / 1e18 * Number(agBalance) / 1e18).toFixed(2)}` : ''}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Voting Power"
          value={isLoading ? '...' : formatTokenAmount(votingPower)}
          sublabel="Delegated Ag"
          icon={<Vote className="h-4 w-4" />}
        />
        <StatCard
          label="Protocol TVL"
          value={tvl?.valid ? formatUsd(Number(tvl.tvl) / 1e18) : '--'}
          sublabel={tvl?.valid ? `TWATVL: ${formatUsd(Number(tvl.twatvl) / 1e18)}` : ''}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Live Market Prices */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Live Markets</h2>
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${!liveLoading && livePrices.some(p => p.valid) ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-xs text-muted-foreground">{liveLoading ? 'Loading' : 'Live'}</span>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {livePrices.map((p) => (
            <div key={p.symbol} className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2 min-w-[140px]">
              <div className="text-lg">{p.symbol === 'ETH' ? '💜' : p.symbol === 'BTC' ? '🟠' : '💵'}</div>
              <div>
                <div className="text-sm font-medium">{p.symbol}</div>
                <div className="text-xs text-muted-foreground">
                  {p.valid && p.priceUsd != null ? `$${p.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                </div>
              </div>
            </div>
          ))}
          <Link href="/swap" className="flex items-center gap-2 rounded-lg border border-border bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors min-w-[120px] justify-center">
            <TrendingUp className="h-4 w-4" />
            Trade
          </Link>
        </div>
      </div>

      {/* Quick Actions - horizontal scrollable strip, bleeds into container edges */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          <ActionCard
            title="Swap Tokens"
            description="Trade Au, Ag, USDC on Aerodrome"
            href="/swap"
            icon={<ArrowRight className="h-4 w-4" />}
          />
          <ActionCard
            title="Manage Liquidity"
            description="Add/remove LP, vote on gauges, claim AERO"
            href="/liquidity"
            icon={<Droplets className="h-4 w-4" />}
          />
          <ActionCard
            title="Stake & Govern"
            description="Stake LP NFTs, vote on proposals"
            href="/stake"
            icon={<BarChart3 className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Protocol Health */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Protocol Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Au Supply</div>
            <div className="font-medium">{isLoading ? '...' : formatTokenAmount(auSupply)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Ag Supply</div>
            <div className="font-medium">{isLoading ? '...' : formatTokenAmount(agSupply)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Au Price Source</div>
            <div className="font-medium">{au?.source === 0 ? 'Chainlink' : au?.source === 1 ? 'TWAP' : 'None'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Oracle Status</div>
            <div className="font-medium flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${au?.valid && ag?.valid ? 'bg-green-500' : 'bg-yellow-500'}`} />
              {au?.valid && ag?.valid ? 'Operational' : 'Degraded'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sublabel, icon }: { label: string; value: string; sublabel?: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-[160px] md:min-w-0 flex-1 md:flex-none rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="text-xl font-semibold">{value}</div>
      {sublabel && <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>}
    </div>
  )
}

function ActionCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group min-w-[220px] md:min-w-0 flex-1 md:flex-none snap-start rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{title}</h3>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">{icon}</div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  )
}

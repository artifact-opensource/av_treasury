'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Droplets, Plus, Minus, Vote as VoteIcon, Gift, Loader2, ExternalLink } from 'lucide-react'
import { LiquidityAdd } from '@/components/liquidity/add'
import { LiquidityRemove } from '@/components/liquidity/remove'
import { LiquidityVote } from '@/components/liquidity/vote'
import { LiquidityClaim } from '@/components/liquidity/claim'
import { KNOWN_POOLS, TOKEN_META, EXPLORER } from '@/lib/constants'
import { cn } from '@/lib/utils'

type Tab = 'add' | 'remove' | 'vote' | 'claim'

export default function LiquidityPage() {
  const { isConnected } = useAccount()
  const [selectedPool, setSelectedPool] = useState(0)
  const [tab, setTab] = useState<Tab>('add')

  const pool = KNOWN_POOLS[selectedPool]

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Droplets className="h-8 w-8 text-primary" />
        </div>
        <p className="text-muted-foreground">Connect your wallet to manage liquidity</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Liquidity</h1>
        <a href={`${EXPLORER.url}/address/${KNOWN_POOLS[0].tokenA}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          BaseScan <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Pool Selector */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm text-muted-foreground">Select Pool</div>
        <div className="flex flex-wrap gap-2">
          {KNOWN_POOLS.map((p, i) => {
            const [a, b] = p.name.split(' / ')
            const metaA = TOKEN_META[a.toLowerCase()] ?? { icon: '?', symbol: a }
            const metaB = TOKEN_META[b.toLowerCase()] ?? { icon: '?', symbol: b }
            return (
              <button key={p.id} onClick={() => setSelectedPool(i)}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5',
                  i === selectedPool ? 'bg-primary text-primary-foreground' : 'bg-accent hover:bg-accent/80'
                )}>
                {metaA.icon} {metaA.symbol} / {metaB.icon} {metaB.symbol}
                {p.stable && <span className="text-xs opacity-70 ml-1">Stable</span>}
              </button>
            )
          })}
        </div>
        <div className="text-xs text-muted-foreground">
          Aerodrome is the primary DEX on Base. Provide liquidity to earn trading fees and AERO incentives.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-accent p-1">
        {([
          { key: 'add' as Tab, label: 'Add LP', icon: Plus },
          { key: 'remove' as Tab, label: 'Remove LP', icon: Minus },
          { key: 'vote' as Tab, label: 'Vote', icon: VoteIcon },
          { key: 'claim' as Tab, label: 'Claim', icon: Gift },
        ]).map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'add' && <LiquidityAdd pool={pool} />}
      {tab === 'remove' && <LiquidityRemove pool={pool} />}
      {tab === 'vote' && <LiquidityVote />}
      {tab === 'claim' && <LiquidityClaim />}
    </div>
  )
}

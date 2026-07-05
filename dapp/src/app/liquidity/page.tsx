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
        <a href={`${EXPLORER}/address/${pool.address}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          BaseScan <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm text-muted-foreground">Select Pool</div>
        <div className="flex flex-wrap gap-2">
          {KNOWN_POOLS.map((p, i) => {
            const [a, b] = p.name.split('/')
            const metaA = TOKEN_META[a.toLowerCase() as keyof typeof TOKEN_META] ?? { symbol: a, logo: '' }
            const metaB = TOKEN_META[b.toLowerCase() as keyof typeof TOKEN_META] ?? { symbol: b, logo: '' }
            return (
              <button key={i} onClick={() => setSelectedPool(i)}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5',
                  i === selectedPool ? 'bg-primary text-primary-foreground' : 'bg-accent hover:bg-accent/80'
                )}>
                <img src={metaA.logo} alt={metaA.symbol} className="h-4 w-4 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                {metaA.symbol} / <img src={metaB.logo} alt={metaB.symbol} className="h-4 w-4 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none' }} /> {metaB.symbol}
                {p.stable && <span className="text-xs opacity-70 ml-1">Stable</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {(['add', 'remove', 'vote', 'claim'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'add' && <LiquidityAdd pool={pool} />}
      {tab === 'remove' && <LiquidityRemove pool={pool} />}
      {tab === 'vote' && <LiquidityVote pool={pool} />}
      {tab === 'claim' && <LiquidityClaim pool={pool} />}
    </div>
  )
}

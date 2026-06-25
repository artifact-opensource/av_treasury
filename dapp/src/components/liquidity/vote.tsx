'use client'

import { useState, useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Loader2, ExternalLink } from 'lucide-react'
import { AERODROME_VOTER_ABI } from '@/lib/abis'
import { AERODROME, TOKENS, EXPLORER } from '@/lib/constants'

export function LiquidityVote() {
  const [poolId, setPoolId] = useState('')
  const [weight, setWeight] = useState('100')

  const { data: txHash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleVote = useCallback(() => {
    if (!poolId) return
    writeContract({
      address: AERODROME.voter, abi: AERODROME_VOTER_ABI, functionName: 'vote',
      args: [BigInt(poolId), BigInt(weight)],
    })
  }, [poolId, weight, writeContract])

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="text-sm text-muted-foreground">
        Vote with veAERO to direct emissions toward AV Treasury pools on Aerodrome. More votes = more AERO incentives for our pools.
      </div>
      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Pool ID</label>
        <input type="number" placeholder="Enter pool ID" value={poolId} onChange={(e) => setPoolId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Vote Weight</label>
        <input type="number" placeholder="100" value={weight} onChange={(e) => setWeight(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <button onClick={handleVote} disabled={isPending || isConfirming || !poolId}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {isPending || isConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Voting...</span> : isSuccess ? 'Vote Cast!' : 'Cast Vote'}
      </button>
      {txHash && <a href={`${EXPLORER.url}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /> View TX</a>}
    </div>
  )
}

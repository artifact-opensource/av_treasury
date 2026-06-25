'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Loader2, ExternalLink } from 'lucide-react'
import { AERODROME_ROUTER_ABI, ERC20_ABI } from '@/lib/abis'
import { AERODROME, EXPLORER } from '@/lib/constants'

interface Props {
  pool: { id: string; name: string; tokenA: `0x${string}`; tokenB: `0x${string}`; stable: boolean }
}

export function LiquidityRemove({ pool }: Props) {
  const { address } = useAccount()
  const [removeAmount, setRemoveAmount] = useState('')

  const removeBigInt = removeAmount ? BigInt(Math.floor(Number(removeAmount) * 1e18)) : 0n

  const { data: txHash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleRemove = useCallback(() => {
    if (!address || removeBigInt === 0n) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
    writeContract({
      address: AERODROME.routerV2, abi: AERODROME_ROUTER_ABI, functionName: 'removeLiquidity',
      args: [pool.tokenA, pool.tokenB, pool.stable, removeBigInt, 0n, 0n, address, deadline],
    })
  }, [pool, removeBigInt, address, writeContract])

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="text-sm text-muted-foreground">
        Remove liquidity to withdraw your {'{'}tokenA{'}'}/{'{'}tokenB{'}'} position. You will receive both tokens in proportion to the pool reserves.
      </div>
      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">LP Tokens to Remove</label>
        <input type="number" placeholder="0.0" value={removeAmount} onChange={(e) => setRemoveAmount(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <button onClick={handleRemove} disabled={isPending || isConfirming || removeBigInt === 0n}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {isPending || isConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Removing...</span> : isSuccess ? 'Removed!' : 'Remove Liquidity'}
      </button>
      {txHash && <a href={`${EXPLORER.url}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /> View TX</a>}
    </div>
  )
}

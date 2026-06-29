'use client'

import { useState, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Loader2, ExternalLink } from 'lucide-react'
import { AERODROME_ROUTER_ABI, ERC20_ABI } from '@/lib/abis'
import { AERODROME, EXPLORER, TOKEN_META } from '@/lib/constants'
import { formatTokenAmount, cn } from '@/lib/utils'

interface Props {
  pool: { id: string; name: string; tokenA: `0x${string}`; tokenB: `0x${string}`; stable: boolean }
}

export function LiquidityAdd({ pool }: Props) {
  const { address } = useAccount()
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [slippageBps] = useState(50n)

  const amountABigInt = amountA ? BigInt(Math.floor(Number(amountA) * 1e18)) : 0n
  const amountBBigInt = amountB ? BigInt(Math.floor(Number(amountB) * 1e18)) : 0n

  const { data: allowanceA } = useReadContract({
    address: pool.tokenA, abi: ERC20_ABI, functionName: 'allowance', args: [address!, AERODROME.routerV2],
    query: { enabled: !!address && amountABigInt > 0n },
  })
  const { data: allowanceB } = useReadContract({
    address: pool.tokenB, abi: ERC20_ABI, functionName: 'allowance', args: [address!, AERODROME.routerV2],
    query: { enabled: !!address && amountBBigInt > 0n },
  })

  const needsApprovalA = allowanceA !== undefined && amountABigInt > 0n && allowanceA < amountABigInt
  const needsApprovalB = allowanceB !== undefined && amountBBigInt > 0n && allowanceB < amountBBigInt

  const { data: approveHash, writeContract: approveWrite, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveHash })

  const { data: txHash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleApprove = useCallback((token: `0x${string}`) => {
    approveWrite({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [AERODROME.routerV2, BigInt(2) ** BigInt(256) - BigInt(1)] })
  }, [approveWrite])

  const handleAdd = useCallback(() => {
    if (!address || amountABigInt === 0n || amountBBigInt === 0n) return
    const amountAMin = amountABigInt - (amountABigInt * slippageBps) / 10000n
    const amountBMin = amountBBigInt - (amountBBigInt * slippageBps) / 10000n
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
    writeContract({
      address: AERODROME.routerV2, abi: AERODROME_ROUTER_ABI, functionName: 'addLiquidity',
      args: [pool.tokenA, pool.tokenB, pool.stable, amountABigInt, amountBBigInt, amountAMin, amountBMin, address, deadline],
    })
  }, [pool, amountABigInt, amountBBigInt, address, writeContract])

  const isBusy = isPending || isConfirming || isApproving || isApproveConfirming

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Token A Amount</label>
          <input type="number" placeholder="0.0" value={amountA} onChange={(e) => setAmountA(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="flex justify-center text-muted-foreground"><Plus className="h-4 w-4" /></div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Token B Amount</label>
          <input type="number" placeholder="0.0" value={amountB} onChange={(e) => setAmountB(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50 space-y-1">
        <div className="flex justify-between"><span>Pool</span><span>{pool.name} {pool.stable ? '(Stable)' : '(Volatile)'}</span></div>
        <div className="flex justify-between"><span>Slippage</span><span>0.5%</span></div>
      </div>

      {needsApprovalA ? (
        <button onClick={() => handleApprove(pool.tokenA)} disabled={isBusy}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isBusy ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Approving...</span> : 'Approve Token A'}
        </button>
      ) : needsApprovalB ? (
        <button onClick={() => handleApprove(pool.tokenB)} disabled={isBusy}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isBusy ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Approving...</span> : 'Approve Token B'}
        </button>
      ) : (
        <button onClick={handleAdd} disabled={isBusy || amountABigInt === 0n || amountBBigInt === 0n}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isBusy ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding...</span> : isSuccess ? 'Liquidity Added!' : 'Add Liquidity'}
        </button>
      )}

      {txHash && <a href={`${EXPLORER.url}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /> View TX</a>}
    </div>
  )
}

function Plus({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}

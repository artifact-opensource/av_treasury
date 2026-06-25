'use client'

import { useState, useCallback } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Loader2, ExternalLink } from 'lucide-react'
import { AERODROME_GAUGE_ABI } from '@/lib/abis'
import { AERODROME, EXPLORER } from '@/lib/constants'
import { formatTokenAmount } from '@/lib/utils'

export function LiquidityClaim() {
  const [gaugeAddress, setGaugeAddress] = useState('')
  const isValidGauge = gaugeAddress.startsWith('0x') && gaugeAddress.length === 42

  const { data: earned, isLoading: isReadingEarned } = useReadContract({
    address: isValidGauge ? gaugeAddress as `0x${string}` : undefined,
    abi: AERODROME_GAUGE_ABI,
    functionName: 'earned',
    args: [undefined as unknown as `0x${string}`],
    query: { enabled: isValidGauge },
  })

  const { data: txHash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleClaim = useCallback(() => {
    if (!isValidGauge) return
    writeContract({ address: gaugeAddress as `0x${string}`, abi: AERODROME_GAUGE_ABI, functionName: 'getReward' })
  }, [gaugeAddress, isValidGauge, writeContract])

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="text-sm text-muted-foreground">
        Claim AERO rewards from Aerodrome gauges. Enter the gauge address for your LP position.
      </div>
      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Gauge Address</label>
        <input type="text" placeholder="0x..." value={gaugeAddress} onChange={(e) => setGaugeAddress(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      {isValidGauge && earned !== undefined && (
        <div className="text-sm p-3 rounded-lg bg-muted/50">
          Claimable: <span className="font-medium">{formatTokenAmount(earned as bigint)}</span> AERO
        </div>
      )}
      <button onClick={handleClaim} disabled={isPending || isConfirming || !isValidGauge}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {isPending || isConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Claiming...</span> : isSuccess ? 'Claimed!' : 'Claim Rewards'}
      </button>
      {txHash && <a href={`${EXPLORER.url}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /> View TX</a>}
    </div>
  )
}

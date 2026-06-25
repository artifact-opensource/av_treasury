'use client'

import { useAccount } from 'wagmi'
import { useStaking } from '@/hooks/use-staking'
import { usePortfolio } from '@/hooks/use-portfolio'
import { useOraclePrices } from '@/hooks/use-oracle'
import { formatTokenAmount, formatUsd } from '@/lib/utils'
import { AV_CONTRACTS } from '@/lib/constants'
import { Coins, Loader2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi'
import { STAKING_ABI, AG_TOKEN_ABI } from '@/lib/abis'
import { TOKENS } from '@/lib/constants'

export default function StakePage() {
  const { address, isConnected } = useAccount()
  const {
    stakedNFTs, totalWeights, totalStakedNFTs,
    auRewardPerBlock, agRewardPerBlock,
    agThreshold, agMultiplier, minStakeDuration,
    stake, unstake, claimRewards, delegate,
    isPending, isConfirming, isSuccess, isLoading, refetch,
  } = useStaking()

  const [tokenIdInput, setTokenIdInput] = useState('')

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Connect your wallet to stake</p>
      </div>
    )
  }

  const multiplierX = Number(agMultiplier) / 10000

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Stake</h1>

      {/* Staking Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Your Multiplier</div>
          <div className="text-2xl font-bold mt-1">{multiplierX.toFixed(2)}x</div>
          <div className="text-xs text-muted-foreground mt-1">
            Threshold: {formatTokenAmount(agThreshold)} Ag
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Staked NFTs</div>
          <div className="text-2xl font-bold mt-1">{stakedNFTs.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Total: {totalStakedNFTs.toString()}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Au/Block</div>
          <div className="text-2xl font-bold mt-1">{formatTokenAmount(auRewardPerBlock)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Ag/Block</div>
          <div className="text-2xl font-bold mt-1">{formatTokenAmount(agRewardPerBlock)}</div>
        </div>
      </div>

      {/* Stake NFT */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Stake LP NFT</h2>
        <p className="text-sm text-muted-foreground">
          Stake your Aerodrome LP NFTs to earn Au and Ag rewards. Bonus multiplier based on your Ag holdings.
          Min stake duration: {minStakeDuration > 0n ? `${Number(minStakeDuration) / 86400} days` : 'None'}.
        </p>
        <div className="flex gap-3">
          <input
            type="number"
            placeholder="Token ID"
            value={tokenIdInput}
            onChange={(e) => setTokenIdInput(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => stake(BigInt(tokenIdInput))}
            disabled={isPending || isConfirming || !tokenIdInput}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending || isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Stake'}
          </button>
        </div>
      </div>

      {/* Your Staked NFTs */}
      {stakedNFTs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Your Staked NFTs</h2>
          <div className="space-y-2">
            {stakedNFTs.map((tokenId) => (
              <NFTStakeRow
                key={tokenId.toString()}
                tokenId={tokenId}
                onUnstake={() => unstake(tokenId)}
                onClaim={() => claimRewards(stakedNFTs)}
              />
            ))}
          </div>
          <button
            onClick={() => claimRewards(stakedNFTs)}
            disabled={isPending || isConfirming}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Claim All Rewards
          </button>
        </div>
      )}

      {/* Delegate */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Delegate Voting Power</h2>
        <p className="text-sm text-muted-foreground">
          Self-delegate your Ag tokens to enable voting on governance proposals.
        </p>
        <button
          onClick={() => delegate()}
          disabled={isPending || isConfirming}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-colors"
        >
          Self-Delegate
        </button>
      </div>
    </div>
  )
}

function NFTStakeRow({ tokenId, onUnstake, onClaim }: { tokenId: bigint; onUnstake: () => void; onClaim: () => void }) {
  const { data } = useReadContracts({
    contracts: [
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'pendingAu', args: [tokenId] },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'pendingAg', args: [tokenId] },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: '_stakedWeights', args: [tokenId] },
    ],
  })

  const pendingAu = (data?.[0]?.result as bigint) ?? 0n
  const pendingAg = (data?.[1]?.result as bigint) ?? 0n
  const weight = (data?.[2]?.result as bigint) ?? 0n

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="space-y-1">
        <div className="font-mono text-sm">NFT #{tokenId.toString()}</div>
        <div className="text-xs text-muted-foreground">
          Weight: {formatTokenAmount(weight)} | Pending: {formatTokenAmount(pendingAu)} Au + {formatTokenAmount(pendingAg)} Ag
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onClaim} className="rounded px-2 py-1 text-xs bg-accent hover:bg-accent/80">
          Claim
        </button>
        <button onClick={onUnstake} className="rounded px-2 py-1 text-xs destructive hover:destructive/80">
          Unstake
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Vote, Loader2 } from 'lucide-react'
import { GOVERNOR_ABI, AG_TOKEN_ABI } from '@/lib/abis'
import { AV_CONTRACTS, TOKENS } from '@/lib/constants'
import { formatTokenAmount, cn } from '@/lib/utils'

enum ProposalState { Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed }

export default function GovernancePage() {
  const { address, isConnected } = useAccount()
  const [proposalIdInput, setProposalIdInput] = useState('')
  const [support, setSupport] = useState(1) // 0=against, 1=for, 2=abstain

  // Read governor state
  const { data, isLoading } = useReadContracts({
    contracts: address ? [
      { address: AV_CONTRACTS.governor, abi: GOVERNOR_ABI, functionName: 'proposalThreshold' },
      { address: AV_CONTRACTS.governor, abi: GOVERNOR_ABI, functionName: 'proposalCount' },
      { address: AV_CONTRACTS.governor, abi: GOVERNOR_ABI, functionName: 'votingDelay' },
      { address: AV_CONTRACTS.governor, abi: GOVERNOR_ABI, functionName: 'votingPeriod' },
      { address: TOKENS.ag, abi: AG_TOKEN_ABI, functionName: 'getVotes', args: [address] },
    ] : [],
    query: { enabled: !!address },
  })

  const proposalThreshold = (data?.[0]?.result as bigint) ?? 0n
  const proposalCount = (data?.[1]?.result as bigint) ?? 0n
  const votingDelay = (data?.[2]?.result as bigint) ?? 0n
  const votingPeriod = (data?.[3]?.result as bigint) ?? 0n
  const votingPower = (data?.[4]?.result as bigint) ?? 0n

  // Vote
  const { data: voteTxHash, writeContract: voteWrite, isPending: isVoting } = useWriteContract()
  const { isLoading: isVoteConfirming, isSuccess: isVoteSuccess } = useWaitForTransactionReceipt({ hash: voteTxHash })

  const handleVote = useCallback(() => {
    if (!proposalIdInput) return
    voteWrite({
      address: AV_CONTRACTS.governor,
      abi: GOVERNOR_ABI,
      functionName: 'castVote',
      args: [BigInt(proposalIdInput), support],
    })
  }, [proposalIdInput, support, voteWrite])

  // Fetch recent proposals
  const proposalIds = Array.from({ length: Math.min(Number(proposalCount), 10) }, (_, i) =>
    Number(proposalCount) - i
  )

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Connect your wallet to participate in governance</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Governance</h1>

      {/* Governance Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Your Votes</div>
          <div className="text-2xl font-bold mt-1">{formatTokenAmount(votingPower)}</div>
          <div className="text-xs text-muted-foreground">Ag delegated</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Proposals</div>
          <div className="text-2xl font-bold mt-1">{proposalCount.toString()}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Threshold</div>
          <div className="text-2xl font-bold mt-1">{formatTokenAmount(proposalThreshold)}</div>
          <div className="text-xs text-muted-foreground">Ag to propose</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Voting Period</div>
          <div className="text-2xl font-bold mt-1">{votingPeriod.toString()}</div>
          <div className="text-xs text-muted-foreground">blocks</div>
        </div>
      </div>

      {/* Vote on Proposal */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Vote on Proposal</h2>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Proposal ID</label>
          <input
            type="number"
            placeholder="Enter proposal ID"
            value={proposalIdInput}
            onChange={(e) => setProposalIdInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 0, label: 'Against', color: 'destructive' },
            { value: 1, label: 'For', color: 'primary' },
            { value: 2, label: 'Abstain', color: 'muted' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setSupport(option.value)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                support === option.value ? 'bg-primary text-primary-foreground' : 'bg-accent hover:bg-accent/80'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleVote}
          disabled={isVoting || isVoteConfirming || !proposalIdInput || votingPower === 0n}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isVoting || isVoteConfirming ? (
            <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Voting...</span>
          ) : isVoteSuccess ? 'Vote Cast!' : 'Cast Vote'}
        </button>
        {votingPower === 0n && (
          <p className="text-xs text-destructive">You must self-delegate Ag before voting.</p>
        )}
      </div>

      {/* Recent Proposals */}
      {proposalCount > 0n && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Recent Proposals</h2>
          <ProposalList proposalIds={proposalIds} />
        </div>
      )}
    </div>
  )
}

function ProposalList({ proposalIds }: { proposalIds: number[] }) {
  const { data } = useReadContracts({
    contracts: proposalIds.flatMap((id) => [
      { address: AV_CONTRACTS.governor, abi: GOVERNOR_ABI, functionName: 'state', args: [BigInt(id)] },
      { address: AV_CONTRACTS.governor, abi: GOVERNOR_ABI, functionName: 'proposalDescriptions', args: [BigInt(id)] },
    ]),
  })

  return (
    <div className="space-y-2">
      {proposalIds.map((id, i) => {
        const state = data?.[i * 2]?.result as number | undefined
        const description = data?.[i * 2 + 1]?.result as string | undefined
        const stateLabel = state !== undefined ? ProposalState[state] : 'Unknown'

        return (
          <div key={id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">#{id}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{description ?? 'Loading...'}</div>
            </div>
            <div className={cn(
              'rounded px-2 py-0.5 text-xs font-medium',
              state === 1 ? 'bg-green-500/10 text-green-500' :
              state === 4 ? 'bg-blue-500/10 text-blue-500' :
              state === 7 ? 'bg-primary/10 text-primary' :
              state === 3 ? 'bg-red-500/10 text-red-500' :
              'bg-accent text-muted-foreground'
            )}>
              {stateLabel}
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { HardDrive, Shield, Lock, Unlock, Search, ArrowRightLeft, Loader2, CheckCircle2, XCircle, AlertCircle, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTokenAmount, formatAddress } from '@/lib/utils'
import { AV_CONTRACTS } from '@/lib/constants'
import { ANVIL_WALLET_ABI, AU_TOKEN_ABI } from '@/lib/abis'
import { Address, zeroAddress } from 'viem'

type HwStatus = 'not_detected' | 'detected_not_setup' | 'ready'

export default function ColdStoragePage() {
  const { address, isConnected } = useAccount()
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [detectionRun, setDetectionRun] = useState(false)

  // Check if AnvilWallet contract is deployed (has code)
  const { data: ownerData, isLoading: isLoadingOwner, refetch: refetchHw } = useReadContract({
    address: AV_CONTRACTS.anvilWallet,
    abi: ANVIL_WALLET_ABI,
    functionName: 'owner',
    query: {
      enabled: detectionRun,
    },
  })

  // Check hardware wallet address
  const { data: hwAddress } = useReadContract({
    address: AV_CONTRACTS.anvilWallet,
    abi: ANVIL_WALLET_ABI,
    functionName: 'hardwareWallet',
    query: {
      enabled: detectionRun && ownerData !== undefined,
    },
  })

  // Check if hardware wallet is set
  const { data: isHwSet } = useReadContract({
    address: AV_CONTRACTS.anvilWallet,
    abi: ANVIL_WALLET_ABI,
    functionName: 'isHardwareWalletSet',
    query: {
      enabled: detectionRun && ownerData !== undefined,
    },
  })

  // Get cold storage balance (Au token balance of AnvilWallet)
  const { data: coldBalance } = useReadContract({
    address: AV_CONTRACTS.auToken,
    abi: AU_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [AV_CONTRACTS.anvilWallet],
    query: {
      enabled: detectionRun && isHwSet === true,
    },
  })

  // Check if cold transfers are enabled
  const { data: coldTransferEnabled } = useReadContract({
    address: AV_CONTRACTS.anvilWallet,
    abi: ANVIL_WALLET_ABI,
    functionName: 'coldTransferEnabled',
    query: {
      enabled: detectionRun && isHwSet === true,
    },
  })

  // Write contract for sending from cold storage
  const { writeContract, isPending, isSuccess, isError, error } = useWriteContract()

  const handleDetect = useCallback(() => {
    setDetectionRun(true)
    refetchHw()
  }, [refetchHw])

  const handleSendFromCold = useCallback(() => {
    if (!sendTo || !sendAmount) return
    writeContract({
      address: AV_CONTRACTS.anvilWallet,
      abi: ANVIL_WALLET_ABI,
      functionName: 'sendFromCold',
      args: [sendTo as Address, BigInt(parseFloat(sendAmount) * 1e18)],
    })
  }, [sendTo, sendAmount, writeContract])

  // Determine hardware wallet status
  const getHwStatus = (): HwStatus => {
    if (!detectionRun) return 'not_detected'
    if (isLoadingOwner) return 'not_detected'
    if (ownerData === undefined || ownerData === zeroAddress) return 'not_detected'
    if (hwAddress === zeroAddress || hwAddress === undefined) return 'detected_not_setup'
    if (isHwSet) return 'ready'
    return 'detected_not_setup'
  }

  const hwStatus = getHwStatus()

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <HardDrive className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground text-lg">Connect your wallet to access Cold Storage</p>
          <p className="text-sm text-muted-foreground/70">Hardware wallet management requires a connected wallet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <HardDrive className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cold Storage</h1>
          <p className="text-sm text-muted-foreground">Hardware wallet management & secure transfers</p>
        </div>
      </div>

      {/* Detection Card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Hardware Wallet Detection
          </h2>
          <button
            onClick={handleDetect}
            disabled={isLoadingOwner}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoadingOwner ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Detect Hardware Wallet
          </button>
        </div>

        {/* Status Display */}
        {detectionRun && (
          <div className="space-y-3">
            <div className={cn(
              'flex items-center gap-3 rounded-lg border p-4',
              hwStatus === 'ready' && 'border-green-500/30 bg-green-500/5',
              hwStatus === 'detected_not_setup' && 'border-yellow-500/30 bg-yellow-500/5',
              hwStatus === 'not_detected' && 'border-red-500/30 bg-red-500/5',
            )}>
              {hwStatus === 'ready' && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <div>
                    <div className="font-medium text-green-500">Ready</div>
                    <div className="text-sm text-muted-foreground">
                      Hardware wallet configured and operational
                    </div>
                  </div>
                </>
              )}
              {hwStatus === 'detected_not_setup' && (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                  <div>
                    <div className="font-medium text-yellow-500">Detected - Not Set Up</div>
                    <div className="text-sm text-muted-foreground">
                      AnvilWallet contract found but no hardware wallet address configured
                    </div>
                  </div>
                </>
              )}
              {hwStatus === 'not_detected' && (
                <>
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <div className="font-medium text-red-500">Not Detected</div>
                    <div className="text-sm text-muted-foreground">
                      No AnvilWallet contract found at the configured address
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Contract Details */}
            {ownerData && ownerData !== zeroAddress && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Contract Owner</div>
                  <div className="font-mono text-sm">{formatAddress(ownerData as string)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Hardware Wallet</div>
                  <div className="font-mono text-sm">
                    {hwAddress && hwAddress !== zeroAddress
                      ? formatAddress(hwAddress as string)
                      : 'Not configured'}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Contract Address</div>
                  <div className="font-mono text-sm">{formatAddress(AV_CONTRACTS.anvilWallet)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Transfer Mode</div>
                  <div className="font-mono text-sm flex items-center gap-1">
                    {coldTransferEnabled ? (
                      <><Unlock className="h-3 w-3 text-green-500" /> Enabled</>
                    ) : (
                      <><Lock className="h-3 w-3 text-yellow-500" /> Disabled</>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!detectionRun && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <HardDrive className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Click &quot;Detect Hardware Wallet&quot; to check the AnvilWallet contract for hardware wallet configuration
            </p>
          </div>
        )}
      </div>

      {/* Ready State: Balance & Actions */}
      {hwStatus === 'ready' && (
        <>
          {/* Balance Card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Cold Storage Balance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs text-muted-foreground uppercase">Au Balance</div>
                <div className="text-2xl font-bold mt-1">
                  {coldBalance !== undefined
                    ? formatTokenAmount(coldBalance as bigint)
                    : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Au Tokens</div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs text-muted-foreground uppercase">Vault Status</div>
                <div className="text-2xl font-bold mt-1 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  Secured
                </div>
                <div className="text-xs text-muted-foreground mt-1">Hardware protected</div>
              </div>
            </div>
          </div>

          {/* Send from Cold Storage */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Send from Cold Storage
            </h2>
            <p className="text-sm text-muted-foreground">
              Initiate a secure transfer from your cold storage. Transactions require hardware wallet confirmation.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase block mb-1.5">Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase block mb-1.5">Amount (Au)</label>
                <input
                  type="number"
                  placeholder="0.0"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleSendFromCold}
                disabled={!sendTo || !sendAmount || isPending}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isPending ? 'Confirm in wallet...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="h-4 w-4" />
                    Send from Cold Storage
                  </>
                )}
              </button>
              {isSuccess && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-500 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Transaction confirmed!
                </div>
              )}
              {isError && error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Transaction failed: {error.message.slice(0, 100)}
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions Placeholder */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Recent Cold Transactions
            </h2>
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Lock className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No recent cold storage transactions
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Transaction history will appear here after on-chain indexing
              </p>
            </div>
          </div>
        </>
      )}

      {/* Not Set Up: Guide Flow */}
      {hwStatus === 'detected_not_setup' && (
        <div className="rounded-xl border border-yellow-500/20 bg-card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2 text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            Hardware Wallet Setup Required
          </h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <h3 className="font-medium text-sm">Setup Guide</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Connect your hardware wallet (Ledger, Trezor, etc.) to your computer or phone</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Open the Ethereum app on your hardware wallet</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Call <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">setHardwareWallet(address)</code> on the AnvilWallet contract with your hardware wallet address</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span>Click &quot;Detect Hardware Wallet&quot; again to verify the setup</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">5</span>
                  <span>Once verified, you can deposit Au tokens and use cold storage transfers</span>
                </li>
              </ol>
            </div>
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-600 dark:text-yellow-400">
              <strong>Security Note:</strong> The hardware wallet address should be the public key address derived from your device&apos;s Ethereum derivation path (m/44&apos;/60&apos;/0&apos;/0/0).
            </div>
          </div>
        </div>
      )}

      {/* Not Detected: Contract Not Deployed */}
      {hwStatus === 'not_detected' && detectionRun && (
        <div className="rounded-xl border border-red-500/20 bg-card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2 text-red-500">
            <XCircle className="h-4 w-4" />
            AnvilWallet Contract Not Found
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              No AnvilWallet contract was found at the configured address:
            </p>
            <div className="rounded-lg border border-border bg-background p-3 font-mono text-xs break-all">
              {AV_CONTRACTS.anvilWallet}
            </div>
            <p>
              This could mean:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>The contract has not been deployed yet</li>
              <li>The contract address needs to be updated in constants</li>
              <li>You&apos;re connected to the wrong network (expected Base Mainnet)</li>
            </ul>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-blue-600 dark:text-blue-400">
              <strong>Next Step:</strong> Deploy the AnvilWallet contract and update the address in <code className="bg-muted px-1 py-0.5 rounded text-xs">src/lib/constants.ts</code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

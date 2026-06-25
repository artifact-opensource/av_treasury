'use client'

import { useState, useCallback } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { AERODROME_ROUTER_ABI } from '@/lib/abis'
import { AERODROME, TOKENS } from '@/lib/constants'

type SwapDirection = 'au-to-ag' | 'ag-to-au' | 'au-to-usdc' | 'ag-to-usdc' | 'usdc-to-au' | 'usdc-to-ag'

function getPath(direction: SwapDirection): `0x${string}`[] {
  switch (direction) {
    case 'au-to-ag': return [TOKENS.au, TOKENS.ag]
    case 'ag-to-au': return [TOKENS.ag, TOKENS.au]
    case 'au-to-usdc': return [TOKENS.au, TOKENS.weth, TOKENS.usdc]
    case 'ag-to-usdc': return [TOKENS.ag, TOKENS.weth, TOKENS.usdc]
    case 'usdc-to-au': return [TOKENS.usdc, TOKENS.weth, TOKENS.au]
    case 'usdc-to-ag': return [TOKENS.usdc, TOKENS.weth, TOKENS.ag]
  }
}

export function useSwap(direction: SwapDirection) {
  const [amountIn, setAmountIn] = useState<bigint>(0n)
  const [slippageBps] = useState(50) // 0.5%

  const path = getPath(direction)

  const { data: amountsOut, isLoading: isLoadingQuote } = useReadContract({
    address: AERODROME.routerV2,
    abi: AERODROME_ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [amountIn, path],
    query: {
      enabled: amountIn > 0n,
    },
  })

  const amountOut = (amountsOut as bigint[] | undefined)?.[amountsOut ? amountsOut.length - 1 : 0] ?? 0n
  const amountOutMin = amountOut > 0n ? amountOut - (amountOut * BigInt(slippageBps)) / 10000n : 0n

  const { data: txHash, writeContract, isPending: isWriting } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const executeSwap = useCallback(() => {
    if (amountIn === 0n) return
    writeContract({
      address: AERODROME.routerV2,
      abi: AERODROME_ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [amountIn, amountOutMin, path, undefined as unknown as `0x${string}`, BigInt(Math.floor(Date.now() / 1000) + 1200)],
    })
  }, [amountIn, amountOutMin, path, writeContract])

  return {
    amountIn,
    setAmountIn,
    amountOut,
    amountOutMin,
    slippageBps,
    executeSwap,
    txHash,
    isWriting,
    isConfirming,
    isSuccess,
    isLoadingQuote,
  }
}

"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Connector } from 'wagmi'

interface WalletState {
  isConnected: boolean
  address: `0x${string}` | null
  chainId: number | null
  connector: Connector | null
  connect: (connector?: Connector) => Promise<void>
  disconnect: () => void
  setAddress: (address: `0x${string}` | null) => void
  setChainId: (chainId: number | null) => void
  setConnector: (connector: Connector | null) => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      isConnected: false,
      address: null,
      chainId: null,
      connector: null,
      connect: async (connector) => {
        set({ isConnected: true, connector })
      },
      disconnect: () => {
        set({ isConnected: false, address: null, chainId: null, connector: null })
      },
      setAddress: (address) => set({ address, isConnected: !!address }),
      setChainId: (chainId) => set({ chainId }),
      setConnector: (connector) => set({ connector }),
    }),
    {
      name: 'av-treasury-wallet',
      partialize: (state) => ({ 
        isConnected: state.isConnected,
        address: state.address,
        chainId: state.chainId,
      }),
    }
  )
)

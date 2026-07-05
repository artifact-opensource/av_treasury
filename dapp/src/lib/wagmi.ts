'use client'

import { createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected, metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

export const config = createConfig({
  chains: [base, mainnet],
  connectors: [
    injected({ target: 'metaMask' }),
    metaMask(),
    coinbaseWallet({ appName: 'AV Treasury', appChainIds: [base.id] }),
    walletConnect({ projectId, showQrModal: true }),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [mainnet.id]: http('https://eth.llamarpc.com'),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

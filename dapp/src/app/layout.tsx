import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/lib/providers'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'AV Treasury',
  description: 'The dual-token DAO treasury on Base. Swap Au/Ag, manage Aerodrome LP, stake, govern.',
  openGraph: {
    title: 'AV Treasury',
    description: 'The dual-token DAO treasury on Base. Swap Au/Ag, manage Aerodrome LP, stake, govern.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'AV Treasury',
    description: 'The dual-token DAO treasury on Base.',
  },
  robots: 'index, follow',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0f' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  )
}

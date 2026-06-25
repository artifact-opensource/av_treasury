import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/lib/providers"
import WalletShell from "@/components/wallet-shell"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AV Treasury",
  description: "Artifact Virtual Treasury -- Swap, LP, Stake, Govern on Base",
  openGraph: {
    title: "AV Treasury",
    description: "The dual-token DAO treasury on Base. Swap Au/Ag, manage Aerodrome LP, stake, govern.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-background">
            <WalletShell />
            <main className="container mx-auto px-4 py-6 max-w-7xl">
              {children}
            </main>
            <Toaster />
          </div>
        </Providers>
      </body>
    </html>
  )
}

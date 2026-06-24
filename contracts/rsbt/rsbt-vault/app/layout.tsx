import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'YIELD-PET / Pixel Tamagotchi Morphspace Lab',
  description: 'Autonomous Financial Wrapper & Identity Node',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable} h-full bg-premium-black text-neutral-200`}>
      <body className="h-full flex flex-col premium-grid overflow-x-hidden select-none antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}

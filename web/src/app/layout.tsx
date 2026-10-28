import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "./providers";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { NetworkGate } from "@/components/NetworkGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opaquely",
  description: "Privacy-preserving analytics marketplace on encrypted bill data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:font-semibold focus:text-text"
        >
          Skip to content
        </a>
        <Providers>
          <AppHeader />
          <NetworkGate>
            <main id="main" tabIndex={-1}>
              {children}
            </main>
          </NetworkGate>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}

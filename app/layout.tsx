import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata = {
  title: "VaultKey",
  description: "Institutional permissioned DeFi vault on Solana",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-white">
        <Providers>
          <div className="min-h-screen flex">
            <aside className="w-64 bg-background/70 backdrop-blur border-r border-border/70 px-6 py-4 flex flex-col">
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <img
                    src="/vaultkey-logo.png"
                    alt="VaultKey logo"
                    className="h-8 w-8"
                  />
                  <div className="text-xl font-semibold tracking-tight">
                    VaultKey
                  </div>
                </div>
                <div className="text-xs text-muted mt-1">
                  Institutional permissioned yield
                </div>
              </div>
              <nav className="space-y-2 text-sm">
                <a
                  href="/investor"
                  className="block px-2 py-1 rounded border border-transparent hover:border-border/90 hover:bg-surface/40 transition"
                >
                  Investor
                </a>
                <a
                  href="/admin"
                  className="block px-2 py-1 rounded border border-transparent hover:border-border/90 hover:bg-surface/40 transition"
                >
                  Admin
                </a>
                <a
                  href="/about"
                  className="block px-2 py-1 rounded border border-transparent hover:border-border/90 hover:bg-surface/40 transition"
                >
                  About
                </a>
              </nav>
            </aside>
            <main className="flex-1 px-8 py-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}


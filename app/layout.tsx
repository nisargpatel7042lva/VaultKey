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
            <aside className="w-64 bg-background border-r border-border px-6 py-4 flex flex-col">
              <div className="text-xl font-semibold tracking-tight mb-6">
                VaultKey
              </div>
              <nav className="space-y-2 text-sm">
                <a
                  href="/investor"
                  className="block px-2 py-1 rounded border border-transparent hover:border-border"
                >
                  Investor
                </a>
                <a
                  href="/admin"
                  className="block px-2 py-1 rounded border border-transparent hover:border-border"
                >
                  Admin
                </a>
                <a
                  href="/about"
                  className="block px-2 py-1 rounded border border-transparent hover:border-border"
                >
                  About
                </a>
              </nav>
            </aside>
            <main className="flex-1 bg-slate-950/60 px-8 py-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}


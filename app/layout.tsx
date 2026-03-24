import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { AppShell } from "./components/AppShell";

export const metadata = {
  title: "VaultKey",
  description: "Institutional permissioned DeFi vault on Solana",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-white">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}


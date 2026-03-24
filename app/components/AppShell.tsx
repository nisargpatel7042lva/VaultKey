"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SIDEBAR_STORAGE_KEY = "vaultkey.sidebar.minimized";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "1") setMinimized(true);
    } catch {
      // ignore storage access issues
    }
  }, []);

  const toggleSidebar = () => {
    const next = !minimized;
    setMinimized(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore storage access issues
    }
  };

  const sidebarWidth = minimized ? "w-20" : "w-64";

  return (
    <div className="min-h-screen flex">
      <aside
        className={`${sidebarWidth} relative bg-background/70 backdrop-blur border-r border-border/70 px-4 py-4 flex flex-col transition-all duration-200 ease-out`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3 top-6 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-xs text-muted hover:text-white"
          title={minimized ? "Expand sidebar" : "Minimize sidebar"}
          aria-label={minimized ? "Expand sidebar" : "Minimize sidebar"}
        >
          {minimized ? ">" : "<"}
        </button>

        <div className="mb-6">
          <div className={`flex items-center ${minimized ? "justify-center" : "gap-3"}`}>
            <img src="/vaultkey-logo.png" alt="VaultKey logo" className="h-8 w-8" />
            {!minimized && (
              <div className="text-xl font-semibold tracking-tight">VaultKey</div>
            )}
          </div>
          {!minimized && (
            <div className="text-xs text-muted mt-1">
              Institutional permissioned yield
            </div>
          )}
        </div>

        <nav className="space-y-2 text-sm">
          {!minimized && (
            <div className="mb-1 px-2 text-[11px] uppercase tracking-wide text-muted">
              Main
            </div>
          )}
          <NavItem
            href="/investor"
            label="Investor"
            short="I"
            active={pathname?.startsWith("/investor") ?? false}
            minimized={minimized}
          />
          <NavItem
            href="/admin"
            label="Admin Console"
            short="A"
            active={pathname?.startsWith("/admin") ?? false}
            minimized={minimized}
          />
          <NavItem
            href="/about"
            label="User Guide"
            short="?"
            active={pathname?.startsWith("/about") ?? false}
            minimized={minimized}
          />
        </nav>
      </aside>

      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}

function NavItem({
  href,
  label,
  short,
  active,
  minimized,
}: {
  href: string;
  label: string;
  short: string;
  active: boolean;
  minimized: boolean;
}) {
  const activeClass = active
    ? "border-accent/70 bg-accent/15 text-white"
    : "border-transparent hover:border-border/90 hover:bg-surface/40 text-muted hover:text-white";

  return (
    <Link
      href={href}
      className={`block rounded-lg border transition ${activeClass} ${minimized ? "px-0 py-2 text-center" : "px-3 py-2"}`}
      title={minimized ? label : undefined}
    >
      {minimized ? short : label}
    </Link>
  );
}

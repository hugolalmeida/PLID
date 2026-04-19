"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

const primaryItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/organograma", label: "Organograma" },
  { href: "/tasks", label: "Atividades" },
  { href: "/meetings", label: "Reunioes" },
  { href: "/goals", label: "Metas" },
  { href: "/notifications", label: "Notificacoes" },
  { href: "/auditoria", label: "Auditoria" },
];

const setupItems: NavItem[] = [
  { href: "/organizations", label: "Organizacoes" },
  { href: "/roles", label: "Cargos" },
  { href: "/people", label: "Pessoas" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`block rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--foreground)] hover:bg-[#efe9de]"
      }`}
    >
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [setupMenuOpen, setSetupMenuOpen] = useState(() =>
    setupItems.some((item) => isActivePath(pathname || "", item.href)),
  );

  const showShell = useMemo(() => {
    if (!pathname) return true;
    return pathname !== "/" && !pathname.startsWith("/login");
  }, [pathname]);

  if (!showShell) {
    return <>{children}</>;
  }

  const navigation = (
    <nav className="space-y-5">
      <section>
        <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
          Principal
        </p>
        <div className="mt-2 space-y-1">
          {primaryItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onClick={() => setMobileMenuOpen(false)}
            />
          ))}
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setSetupMenuOpen((state) => !state)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:bg-[#efe9de]"
          aria-expanded={setupMenuOpen}
        >
          <span>Configuracao Inicial</span>
          <span className="text-sm leading-none">{setupMenuOpen ? "−" : "+"}</span>
        </button>
        {setupMenuOpen ? (
          <div className="mt-2 space-y-1">
            {setupItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                onClick={() => setMobileMenuOpen(false)}
              />
            ))}
          </div>
        ) : null}
      </section>
    </nav>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--surface)] md:block">
        <div className="sticky top-0 h-screen overflow-y-auto p-4">
          <Link href="/dashboard" className="block rounded-xl border border-[var(--line)] p-3">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              PLID
            </p>
            <p className="mt-1 text-sm font-semibold">Painel de Lideranca</p>
          </Link>
          <div className="mt-4">{navigation}</div>
        </div>
      </aside>

      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 p-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="text-sm font-semibold">
              PLID
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((state) => !state)}
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-medium"
            >
              Menu
            </button>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="border-b border-[var(--line)] bg-[var(--surface)] p-3 md:hidden">
            {navigation}
          </div>
        ) : null}

        <div>{children}</div>
      </div>
    </div>
  );
}

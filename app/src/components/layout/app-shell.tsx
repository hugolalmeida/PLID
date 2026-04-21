"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member" | "viewer";
};

type WorkspaceContext = {
  enabled: boolean;
  currentWorkspaceId: string | null;
  options: WorkspaceOption[];
};

type WorkspaceContextApiResponse = {
  ok: boolean;
  context?: WorkspaceContext;
};

type ProfileContextApiResponse = {
  ok: boolean;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
};

const primaryItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
];

const operationItems: NavItem[] = [
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

function WorkspaceQuickSwitch({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [context, setContext] = useState<WorkspaceContext | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspaceContext() {
      try {
        const response = await fetch("/api/workspaces/options", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as WorkspaceContextApiResponse;
        if (!active || !payload.ok || !payload.context?.enabled) return;
        setContext(payload.context);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWorkspaceContext();
    return () => {
      active = false;
    };
  }, []);

  async function handleChange(workspaceId: string) {
    if (!workspaceId || switching) return;
    setSwitching(true);

    try {
      const response = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      if (!response.ok) {
        setSwitching(false);
        return;
      }

      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  if (loading || !context || !context.options.length) {
    return null;
  }

  return (
    <div className={compact ? "min-w-[170px]" : "rounded-xl border border-[var(--line)] bg-white p-3"}>
      <label
        className={`block text-xs font-semibold tracking-[0.1em] text-[var(--muted)] uppercase ${
          compact ? "mb-1" : ""
        }`}
      >
        Workspace
      </label>
      <select
        value={context.currentWorkspaceId || ""}
        onChange={(event) => void handleChange(event.target.value)}
        disabled={switching}
        className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-2 text-sm"
      >
        {context.options.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      {!compact ? (
        <Link
          href="/workspaces"
          className="mt-2 inline-block text-xs font-medium text-[var(--accent)] hover:underline"
        >
          Gerenciar espacos
        </Link>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [operationMenuOpen, setOperationMenuOpen] = useState(() =>
    operationItems.some((item) => isActivePath(pathname || "", item.href)),
  );
  const [setupMenuOpen, setSetupMenuOpen] = useState(() =>
    setupItems.some((item) => isActivePath(pathname || "", item.href)),
  );
  const [viewerName, setViewerName] = useState("Usuario");

  useEffect(() => {
    let active = true;

    async function loadProfileContext() {
      try {
        const response = await fetch("/api/profile/me", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as ProfileContextApiResponse;
        if (!active || !payload.ok || !payload.profile) return;

        const nextName =
          payload.profile.full_name || payload.profile.email || "Usuario";
        setViewerName(nextName);
      } catch {
        // noop
      }
    }

    void loadProfileContext();
    return () => {
      active = false;
    };
  }, []);

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
        <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">Principal</p>
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
          onClick={() => setOperationMenuOpen((state) => !state)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:bg-[#efe9de]"
          aria-expanded={operationMenuOpen}
        >
          <span>Operacao</span>
          <span className="text-sm leading-none">{operationMenuOpen ? "-" : "+"}</span>
        </button>
        {operationMenuOpen ? (
          <div className="mt-2 space-y-1">
            {operationItems.map((item) => (
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

      <section>
        <button
          type="button"
          onClick={() => setSetupMenuOpen((state) => !state)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:bg-[#efe9de]"
          aria-expanded={setupMenuOpen}
        >
          <span>Configuracao Inicial</span>
          <span className="text-sm leading-none">{setupMenuOpen ? "-" : "+"}</span>
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
            <div className="flex items-center gap-3">
              <Image
                src="/plid_mark.png"
                alt="PLID"
                width={58}
                height={58}
                className="h-14 w-14 object-contain"
                priority
              />
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
                  PLID
                </p>
                <p className="mt-1 text-sm font-semibold">Painel de Lideranca</p>
              </div>
            </div>
          </Link>
          <div className="mt-3">
            <WorkspaceQuickSwitch />
          </div>
          <div className="mt-4">{navigation}</div>
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
              <span className="truncate text-sm font-medium text-[var(--foreground)]">
                {viewerName}
              </span>
              <Link
                href="/profile"
                title="Editar perfil"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--foreground)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </Link>
            </div>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[#efe9de]"
              >
                Sair da conta
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 p-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-2">
            <Link href="/dashboard" className="inline-flex items-center rounded-lg bg-white px-2 py-1">
              <Image
                src="/plid_mark.png"
                alt="PLID"
                width={140}
                height={48}
                className="h-8 w-auto object-contain"
                priority
              />
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
            <div className="mb-3">
              <WorkspaceQuickSwitch compact />
            </div>
            {navigation}
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                <span className="truncate text-sm font-medium text-[var(--foreground)]">
                  {viewerName}
                </span>
                <Link
                  href="/profile"
                  title="Editar perfil"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--foreground)]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </Link>
              </div>
              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)]"
                >
                  Sair da conta
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <div>{children}</div>
      </div>
    </div>
  );
}

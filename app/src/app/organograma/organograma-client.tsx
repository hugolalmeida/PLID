"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  OrganizationRow,
  PersonRoleRow,
  PersonRow,
  RoleRow,
} from "./types";

const ROOT_KEY = "__root__";

type Selection =
  | { kind: "organization"; id: string }
  | { kind: "role"; id: string }
  | { kind: "personRole"; id: string }
  | null;

type ViewMode = "overview" | "detailed";
type CreateKind = "organization" | "role" | "person" | null;
type OverviewDensity = "compact" | "comfortable";

type BranchProps = {
  organization: OrganizationRow;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  childrenByParent: Map<string, OrganizationRow[]>;
  rolesByOrg: Map<string, RoleRow[]>;
  personRolesByRole: Map<string, PersonRoleRow[]>;
  personById: Map<string, PersonRow>;
};

type OverviewTreeNodeProps = {
  organization: OrganizationRow;
  childrenByParent: Map<string, OrganizationRow[]>;
  rolesByOrg: Map<string, RoleRow[]>;
  personRolesByRole: Map<string, PersonRoleRow[]>;
  personById: Map<string, PersonRow>;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  overviewDensity: OverviewDensity;
  visibleOrganizationIds: Set<string> | null;
};

type LeaderInfo = {
  person: PersonRow;
  roleName: string;
};

function collectDescendantIds(
  rootId: string,
  childrenByParent: Map<string, OrganizationRow[]>,
) {
  const ids = new Set<string>();
  const stack = [rootId];

  while (stack.length) {
    const current = stack.pop();
    if (!current || ids.has(current)) continue;
    ids.add(current);
    const children = childrenByParent.get(current) || [];
    children.forEach((child) => stack.push(child.id));
  }

  return ids;
}

function formatDate(date: string | null) {
  return date || "-";
}

function truncateText(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function buildLevels(
  rootOrganizations: OrganizationRow[],
  childrenByParent: Map<string, OrganizationRow[]>,
) {
  const levels: OrganizationRow[][] = [];
  let currentLevel = rootOrganizations;

  while (currentLevel.length) {
    levels.push(currentLevel);
    const nextLevel: OrganizationRow[] = [];
    currentLevel.forEach((organization) => {
      const children = childrenByParent.get(organization.id) || [];
      children.forEach((child) => nextLevel.push(child));
    });
    currentLevel = nextLevel;
  }

  return levels;
}

function pickLeaderForOrganization(
  organizationId: string,
  rolesByOrg: Map<string, RoleRow[]>,
  personRolesByRole: Map<string, PersonRoleRow[]>,
  personById: Map<string, PersonRow>,
) {
  const roles = rolesByOrg.get(organizationId) || [];
  const candidates: LeaderInfo[] = [];

  roles.forEach((role) => {
    const links = personRolesByRole.get(role.id) || [];
    links.forEach((link) => {
      const person = personById.get(link.person_id);
      if (person && person.active) {
        candidates.push({ person, roleName: role.name });
      }
    });
  });

  if (!candidates.length) return null;

  const leaderByRoleName = candidates.find((candidate) =>
    /presidente|lider|bispo|coordenador|diretor/i.test(candidate.roleName),
  );

  return leaderByRoleName || candidates[0];
}

function OrganizationBranch({
  organization,
  selected,
  onSelect,
  childrenByParent,
  rolesByOrg,
  personRolesByRole,
  personById,
}: BranchProps) {
  const childOrganizations = childrenByParent.get(organization.id) || [];
  const roles = rolesByOrg.get(organization.id) || [];

  return (
    <li className="mt-3">
      <button
        type="button"
        onClick={() => onSelect({ kind: "organization", id: organization.id })}
        className={`w-full rounded-lg border px-3 py-2 text-left ${
          selected?.kind === "organization" && selected.id === organization.id
            ? "border-[var(--accent)] bg-[#e9f3f2]"
            : "border-[var(--line)] bg-white"
        }`}
      >
        <p className="text-sm font-semibold">{organization.name}</p>
        <p className="muted-text text-xs">{organization.type}</p>
      </button>

      {roles.length ? (
        <ul className="ml-4 mt-2 space-y-2 border-l border-dashed border-[var(--line)] pl-3">
          {roles.map((role) => {
            const links = personRolesByRole.get(role.id) || [];

            return (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: "role", id: role.id })}
                  className={`w-full rounded-md border px-2.5 py-2 text-left ${
                    selected?.kind === "role" && selected.id === role.id
                      ? "border-[var(--accent)] bg-[#edf6f5]"
                      : "border-[var(--line)] bg-white"
                  }`}
                >
                  <p className="text-xs font-semibold">{role.name}</p>
                  <p className="muted-text mt-0.5 text-xs">
                    {role.responsibilities || "Sem responsabilidades definidas"}
                  </p>
                </button>

                {links.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {links.map((link) => {
                      const person = personById.get(link.person_id);
                      return (
                        <button
                          key={link.id}
                          type="button"
                          onClick={() =>
                            onSelect({ kind: "personRole", id: link.id })
                          }
                          className={`rounded-full border px-2 py-1 text-xs ${
                            selected?.kind === "personRole" &&
                            selected.id === link.id
                              ? "border-[var(--accent)] bg-[#edf6f5]"
                              : "border-[var(--line)] bg-white"
                          }`}
                        >
                          {person?.name || `Pessoa #${link.person_id.slice(0, 6)}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {childOrganizations.length ? (
        <ul className="ml-4 mt-2 border-l border-dashed border-[var(--line)] pl-3">
          {childOrganizations.map((childOrganization) => (
            <OrganizationBranch
              key={childOrganization.id}
              organization={childOrganization}
              selected={selected}
              onSelect={onSelect}
              childrenByParent={childrenByParent}
              rolesByOrg={rolesByOrg}
              personRolesByRole={personRolesByRole}
              personById={personById}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function OverviewTreeNode({
  organization,
  childrenByParent,
  rolesByOrg,
  personRolesByRole,
  personById,
  selected,
  onSelect,
  overviewDensity,
  visibleOrganizationIds,
}: OverviewTreeNodeProps) {
  const isCompact = overviewDensity === "compact";
  const children = (childrenByParent.get(organization.id) || []).filter((child) =>
    visibleOrganizationIds ? visibleOrganizationIds.has(child.id) : true,
  );
  const orgRoles = rolesByOrg.get(organization.id) || [];

  return (
    <div className={`relative flex items-center ${isCompact ? "gap-2 sm:gap-2.5 md:gap-3" : "gap-2.5 sm:gap-3 md:gap-4"}`}>
      <div className={`${isCompact ? "w-[170px] sm:w-[210px] md:w-[224px]" : "w-[195px] sm:w-[240px] md:w-[260px]"} shrink-0`}>
        <button
          type="button"
          onClick={() => onSelect({ kind: "organization", id: organization.id })}
          className={`w-full rounded-lg border text-center font-semibold transition ${
            selected?.kind === "organization" && selected.id === organization.id
              ? "border-[#0d5f67] bg-[#0d5f67] text-white"
              : "border-[#79d0ce] bg-[#7fd7d4] text-[#0e343b] hover:bg-[#74cdcb]"
          } ${isCompact ? "px-2 py-1.5 text-[12px]" : "px-2.5 py-2 text-sm"}`}
        >
          {organization.name}
          <span className={`mt-0.5 block font-medium opacity-75 ${isCompact ? "text-[9px]" : "text-[10px]"}`}>
            {organization.type}
          </span>
        </button>

        {orgRoles.length ? (
          <div className={`w-full ${isCompact ? "mt-1.5 space-y-0.5" : "mt-2 space-y-1"}`}>
            {orgRoles.map((role) => {
              const links = personRolesByRole.get(role.id) || [];
              const firstLink = links[0] || null;
              const firstPerson = firstLink ? personById.get(firstLink.person_id) : null;
              const roleName = truncateText(
                role.name.toUpperCase(),
                overviewDensity === "compact" ? 18 : 24,
              );
              const personName = truncateText(
                firstPerson?.name || "SEM PESSOA",
                overviewDensity === "compact" ? 18 : 24,
              );

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() =>
                    firstLink
                      ? onSelect({ kind: "personRole", id: firstLink.id })
                      : onSelect({ kind: "role", id: role.id })
                  }
                  className={`w-full rounded-md border px-2 py-1.5 text-left ${
                    (selected?.kind === "role" && selected.id === role.id) ||
                    (selected?.kind === "personRole" &&
                      firstLink &&
                      selected.id === firstLink.id)
                      ? "border-[var(--accent)] bg-[#edf6f5]"
                      : "border-[#d6e7e6] bg-white"
                  } ${isCompact ? "py-1" : "py-1.5"}`}
                >
                  <p className={`truncate whitespace-nowrap font-semibold tracking-[0.03em] text-[#123a40] ${isCompact ? "text-[9px]" : "text-[10px]"}`}>
                    {roleName} - {personName}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={`w-full rounded-md border border-dashed border-[#c6d9d8] bg-white px-2 text-center text-[var(--muted)] ${isCompact ? "mt-1.5 py-1 text-[9px]" : "mt-2 py-1.5 text-[10px]"}`}>
            Sem cargos
          </div>
        )}
      </div>

      {children.length ? (
        <div className={`relative ${isCompact ? "pt-6" : "pt-8"}`}>
          {children.length > 1 ? (
            <div className="absolute left-0 top-[calc(2.5rem)] h-[calc(100%-5rem)] w-px rounded-full bg-[#5f9fa2]" />
          ) : null}
          <div className={`flex flex-col ${isCompact ? "gap-2" : "gap-3"}`}>
            {children.map((child) => (
              <div key={child.id} className={`flex items-start ${isCompact ? "gap-2" : "gap-2.5"}`}>
                <svg
                  viewBox="0 0 18 24"
                  className={`${isCompact ? "mt-1.5 h-5 w-4" : "mt-2 h-6 w-[18px]"} shrink-0`}
                  aria-hidden="true"
                >
                  <path
                    d="M1 1 V12 Q1 20 9 20 H17"
                    fill="none"
                    stroke="#5f9fa2"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <OverviewTreeNode
                  organization={child}
                  childrenByParent={childrenByParent}
                  rolesByOrg={rolesByOrg}
                  personRolesByRole={personRolesByRole}
                  personById={personById}
                  selected={selected}
                  onSelect={onSelect}
                  overviewDensity={overviewDensity}
                  visibleOrganizationIds={visibleOrganizationIds}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type OrganogramaClientProps = {
  organizations: OrganizationRow[];
  roles: RoleRow[];
  personRoles: PersonRoleRow[];
  people: PersonRow[];
  canManage: boolean;
};

export function OrganogramaClient({
  organizations,
  roles,
  personRoles,
  people,
  canManage,
}: OrganogramaClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Selection>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overviewDensity, setOverviewDensity] = useState<OverviewDensity>("compact");
  const [fitToScreen, setFitToScreen] = useState(true);
  const [focusOrganizationId, setFocusOrganizationId] = useState("");
  const [createPersonOrganizationId, setCreatePersonOrganizationId] = useState("");
  const [createPersonRoleId, setCreatePersonRoleId] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const treeViewportRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  });

  const organizationById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization])),
    [organizations],
  );

  const personById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );

  const organizationNameById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations],
  );
  const rolesFilteredForCreatePerson = useMemo(() => {
    if (!createPersonOrganizationId) return roles;
    return roles.filter((role) => role.organization_id === createPersonOrganizationId);
  }, [roles, createPersonOrganizationId]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, OrganizationRow[]>();
    organizations.forEach((organization) => {
      const key =
        organization.parent_id && organizationById.has(organization.parent_id)
          ? organization.parent_id
          : ROOT_KEY;
      const current = map.get(key) || [];
      current.push(organization);
      map.set(key, current);
    });
    return map;
  }, [organizations, organizationById]);

  const rolesByOrg = useMemo(() => {
    const map = new Map<string, RoleRow[]>();
    roles.forEach((role) => {
      const current = map.get(role.organization_id) || [];
      current.push(role);
      map.set(role.organization_id, current);
    });
    return map;
  }, [roles]);

  const personRolesByRole = useMemo(() => {
    const map = new Map<string, PersonRoleRow[]>();
    personRoles.forEach((personRole) => {
      const current = map.get(personRole.role_id) || [];
      current.push(personRole);
      map.set(personRole.role_id, current);
    });
    return map;
  }, [personRoles]);

  const rootOrganizations = useMemo(
    () => childrenByParent.get(ROOT_KEY) || [],
    [childrenByParent],
  );

  const visibleOrganizationIds = useMemo(() => {
    if (!focusOrganizationId) return null;
    if (!organizationById.has(focusOrganizationId)) return null;
    return collectDescendantIds(focusOrganizationId, childrenByParent);
  }, [focusOrganizationId, organizationById, childrenByParent]);

  const rootOrganizationsForView = useMemo(() => {
    if (!visibleOrganizationIds) {
      return rootOrganizations;
    }
    const focusedRoot = organizationById.get(focusOrganizationId);
    return focusedRoot ? [focusedRoot] : rootOrganizations;
  }, [visibleOrganizationIds, rootOrganizations, organizationById, focusOrganizationId]);

  const levels = useMemo(
    () => buildLevels(rootOrganizationsForView, childrenByParent),
    [rootOrganizationsForView, childrenByParent],
  );
  const visibleOrganizationsCount = useMemo(() => {
    if (!visibleOrganizationIds) return organizations.length;
    return visibleOrganizationIds.size;
  }, [visibleOrganizationIds, organizations.length]);
  const fitScale = useMemo(() => {
    if (!fitToScreen) return 1;
    if (visibleOrganizationsCount <= 6) return 0.98;
    if (visibleOrganizationsCount <= 10) return 0.94;
    if (visibleOrganizationsCount <= 14) return 0.9;
    if (visibleOrganizationsCount <= 20) return 0.86;
    return 0.82;
  }, [fitToScreen, visibleOrganizationsCount]);

  function onTreePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, label")) return;

    const viewport = treeViewportRef.current;
    if (!viewport) return;

    panStateRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      moved: false,
    };
    setIsPanning(true);
    viewport.setPointerCapture?.(event.pointerId);
  }

  function onTreePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = treeViewportRef.current;
    if (!viewport || !panStateRef.current.dragging) return;

    const dx = event.clientX - panStateRef.current.startX;
    const dy = event.clientY - panStateRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      panStateRef.current.moved = true;
    }

    viewport.scrollLeft = panStateRef.current.scrollLeft - dx;
    viewport.scrollTop = panStateRef.current.scrollTop - dy;
  }

  function stopTreePan(event?: React.PointerEvent<HTMLDivElement>) {
    if (!panStateRef.current.dragging) return;
    panStateRef.current.dragging = false;
    setIsPanning(false);
    if (event) {
      const viewport = treeViewportRef.current;
      viewport?.releasePointerCapture?.(event.pointerId);
    }
  }

  const effectiveSelected = useMemo<Selection>(() => {
    if (!selected) {
      return null;
    }

    if (selected.kind === "organization") {
      return organizationById.has(selected.id) ? selected : null;
    }

    if (selected.kind === "role") {
      return roleById.has(selected.id) ? selected : null;
    }

    return personRoles.find((item) => item.id === selected.id) ? selected : null;
  }, [selected, organizationById, roleById, personRoles]);

  const details = useMemo(() => {
    if (!effectiveSelected) {
      return null;
    }

    if (effectiveSelected.kind === "organization") {
      const organization = organizationById.get(effectiveSelected.id);
      if (!organization) {
        return {
          title: "Organizacao nao encontrada",
          description: "Esse registro pode ter sido removido.",
        };
      }

      const parentName = organization.parent_id
        ? organizationById.get(organization.parent_id)?.name || "Nao encontrado"
        : "Raiz";
      const levelIndex = levels.findIndex((level) =>
        level.some((item) => item.id === organization.id),
      );
      const leader = pickLeaderForOrganization(
        organization.id,
        rolesByOrg,
        personRolesByRole,
        personById,
      );

      return {
        title: organization.name,
        description: organization.type,
        lines: [
          `Nivel hierarquico: ${levelIndex >= 0 ? levelIndex + 1 : "-"}`,
          `Organizacao pai: ${parentName}`,
          `Lider atual: ${leader?.person.name || "Nao definido"}`,
          `Cargo do lider: ${leader?.roleName || "-"}`,
          `E-mail: ${leader?.person.email || "-"}`,
          `Telefone: ${leader?.person.phone || "-"}`,
        ],
      };
    }

    if (effectiveSelected.kind === "role") {
      const role = roleById.get(effectiveSelected.id);
      if (!role) {
        return {
          title: "Cargo nao encontrado",
          description: "Esse registro pode ter sido removido.",
        };
      }

      const organizationName =
        organizationById.get(role.organization_id)?.name || "Nao encontrado";
      const linkedPeople = personRolesByRole.get(role.id) || [];
      const person = linkedPeople.length ? personById.get(linkedPeople[0].person_id) : null;

      return {
        title: role.name,
        description: role.responsibilities || "Sem responsabilidades registradas.",
        lines: [
          `Organizacao: ${organizationName}`,
          `Pessoa vinculada: ${person?.name || "Nao definida"}`,
          `E-mail: ${person?.email || "-"}`,
          `Telefone: ${person?.phone || "-"}`,
        ],
      };
    }

    const personRole = personRoles.find((item) => item.id === effectiveSelected.id);
    if (!personRole) {
      return {
        title: "Vinculo nao encontrado",
        description: "Esse registro pode ter sido removido.",
      };
    }

    const person = personById.get(personRole.person_id);
    const role = roleById.get(personRole.role_id);

    return {
      title: person?.name || `Pessoa #${personRole.person_id.slice(0, 6)}`,
      description: role?.name || "Cargo nao encontrado",
      lines: [
        `Inicio: ${formatDate(personRole.start_date)}`,
        `Fim: ${formatDate(personRole.end_date)}`,
        `E-mail: ${person?.email || "-"}`,
        `Telefone: ${person?.phone || "-"}`,
      ],
    };
  }, [
    effectiveSelected,
    organizationById,
    rolesByOrg,
    roleById,
    personRolesByRole,
    personRoles,
    personById,
    levels,
  ]);

  if (!organizations.length) {
    return (
      <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-6">
        <h2 className="text-lg font-semibold">Organograma ainda vazio</h2>
        <p className="muted-text mt-2 text-sm">
          Cadastre organizacoes, cargos e vinculos para montar a visualizacao.
        </p>
      </section>
    );
  }

  async function submitCreateForm(
    endpoint: string,
    formData: FormData,
    successMessage: string,
  ) {
    setIsSubmitting(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setCreateError(payload.error || "Nao foi possivel salvar.");
        return;
      }

      setCreateSuccess(successMessage);
      setCreateKind(null);
      router.refresh();
    } catch {
      setCreateError("Falha inesperada ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-6">
      <article className="rounded-xl border border-[var(--line)] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Estrutura interativa</h2>
            <p className="muted-text mt-1 text-sm">
              Modo geral para visao completa e modo detalhado para navegacao por clique.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[#f8f4ee] p-1 text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={() => setViewMode("overview")}
              className={`rounded-md px-2.5 py-1 ${
                viewMode === "overview"
                  ? "bg-white font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)]"
              }`}
            >
              Visao Geral
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detailed")}
              className={`rounded-md px-2.5 py-1 ${
                viewMode === "detailed"
                  ? "bg-white font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)]"
              }`}
            >
              Visao Detalhada
            </button>
          </div>
          {viewMode === "overview" ? (
            <div className="rounded-lg border border-[var(--line)] bg-[#f8f4ee] p-1 text-[11px] sm:text-xs">
              <button
                type="button"
                onClick={() => setOverviewDensity("compact")}
                className={`rounded-md px-2.5 py-1 ${
                  overviewDensity === "compact"
                    ? "bg-white font-semibold text-[var(--accent)]"
                    : "text-[var(--muted)]"
                }`}
              >
                Compacto
              </button>
              <button
                type="button"
                onClick={() => setOverviewDensity("comfortable")}
                className={`rounded-md px-2.5 py-1 ${
                  overviewDensity === "comfortable"
                    ? "bg-white font-semibold text-[var(--accent)]"
                    : "text-[var(--muted)]"
                }`}
              >
                Conforto
              </button>
            </div>
          ) : null}
          {viewMode === "overview" ? (
            <button
              type="button"
              onClick={() => setFitToScreen((state) => !state)}
              className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium"
            >
              {fitToScreen ? "Zoom 100%" : "Ajustar tela"}
            </button>
          ) : null}
        </div>

        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateKind("organization");
                setCreatePersonOrganizationId("");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
            >
              <span className="text-sm leading-none">+</span>
              Organizacao
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateKind("role");
                setCreatePersonOrganizationId("");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
            >
              <span className="text-sm leading-none">+</span>
              Cargo
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateKind("person");
                setCreatePersonOrganizationId("");
                setCreatePersonRoleId("");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
            >
              <span className="text-sm leading-none">+</span>
              Pessoa
            </button>
            {createError ? (
              <p className="text-xs font-medium text-red-700">{createError}</p>
            ) : null}
            {createSuccess ? (
              <p className="text-xs font-medium text-emerald-700">{createSuccess}</p>
            ) : null}
          </div>
        ) : null}

        {viewMode === "overview" ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-[var(--muted)]">
              Filtro por organizacao
              <select
                value={focusOrganizationId}
                onChange={(event) => setFocusOrganizationId(event.target.value)}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
              >
                <option value="">Todas</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            {focusOrganizationId ? (
              <button
                type="button"
                onClick={() => setFocusOrganizationId("")}
                className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-medium"
              >
                Limpar foco
              </button>
            ) : null}
          </div>
        ) : null}

        {viewMode === "overview" ? (
          <div
            className="mx-auto mt-4 w-full max-w-[1280px] rounded-xl border border-[var(--line)] bg-[#dff2f1] p-2 sm:p-3 md:p-4"
            style={
              fitToScreen
                ? { transform: `scale(${fitScale})`, transformOrigin: "top center" }
                : undefined
            }
          >
            <div
              ref={treeViewportRef}
              className={`overflow-x-auto pb-2 ${isPanning ? "cursor-grabbing select-none" : "cursor-grab"}`}
              style={{ touchAction: "none" }}
              onPointerDown={onTreePointerDown}
              onPointerMove={onTreePointerMove}
              onPointerUp={(event) => stopTreePan(event)}
              onPointerCancel={(event) => stopTreePan(event)}
              onPointerLeave={(event) => stopTreePan(event)}
            >
              <div
                className={`mx-auto space-y-4 ${
                  overviewDensity === "compact"
                    ? "min-w-[340px] sm:min-w-[700px]"
                    : "min-w-[420px] sm:min-w-[820px]"
                }`}
              >
                {rootOrganizationsForView
                  .filter((organization) =>
                    visibleOrganizationIds ? visibleOrganizationIds.has(organization.id) : true,
                  )
                  .map((organization) => (
                    <OverviewTreeNode
                      key={organization.id}
                      organization={organization}
                      childrenByParent={childrenByParent}
                      rolesByOrg={rolesByOrg}
                      personRolesByRole={personRolesByRole}
                      personById={personById}
                      selected={effectiveSelected}
                      onSelect={setSelected}
                      overviewDensity={overviewDensity}
                      visibleOrganizationIds={visibleOrganizationIds}
                    />
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <ul className="mt-3">
            {rootOrganizationsForView.map((organization) => (
              <OrganizationBranch
                key={organization.id}
                organization={organization}
                selected={effectiveSelected}
                onSelect={setSelected}
                childrenByParent={childrenByParent}
                rolesByOrg={rolesByOrg}
                personRolesByRole={personRolesByRole}
                personById={personById}
              />
            ))}
          </ul>
        )}
      </article>

      {details ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes do organograma"
          onClick={() => setSelected(null)}
        >
          <div className="modal-card max-w-lg" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-semibold">Detalhes</h2>
              <button type="button" className="modal-close" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </div>
            <div className="modal-body">
              <h3 className="text-sm font-semibold">{details.title}</h3>
              <p className="muted-text mt-1 text-sm">{details.description}</p>
              {"lines" in details && details.lines?.length ? (
                <ul className="muted-text mt-3 space-y-1 text-sm">
                  {details.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {createKind === "organization" ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Nova organizacao">
          <div className="modal-card max-w-xl">
            <div className="modal-header">
              <h2 className="text-base font-semibold">Nova organizacao</h2>
              <button type="button" className="modal-close" onClick={() => setCreateKind(null)}>
                Fechar
              </button>
            </div>
            <form
              className="modal-body grid gap-3 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await submitCreateForm(
                  "/api/organograma/create/organization",
                  new FormData(event.currentTarget),
                  "Organizacao criada com sucesso.",
                );
              }}
            >
              <label className="text-xs font-medium text-[var(--muted)]">
                Nome
                <input name="name" required className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Tipo
                <input name="type" required className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-[var(--muted)] md:col-span-2">
                Organizacao pai
                <select
                  name="parent_id"
                  defaultValue=""
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                >
                  <option value="">Sem pai</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions md:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {createKind === "role" ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Novo cargo">
          <div className="modal-card max-w-xl">
            <div className="modal-header">
              <h2 className="text-base font-semibold">Novo cargo</h2>
              <button type="button" className="modal-close" onClick={() => setCreateKind(null)}>
                Fechar
              </button>
            </div>
            <form
              className="modal-body grid gap-3 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await submitCreateForm(
                  "/api/organograma/create/role",
                  new FormData(event.currentTarget),
                  "Cargo criado com sucesso.",
                );
              }}
            >
              <label className="text-xs font-medium text-[var(--muted)]">
                Nome
                <input name="name" required className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Organizacao
                <select
                  name="organization_id"
                  required
                  defaultValue=""
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-[var(--muted)] md:col-span-2">
                Responsabilidades
                <input
                  name="responsibilities"
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                />
              </label>
              <div className="modal-actions md:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {createKind === "person" ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Nova pessoa">
          <div className="modal-card max-w-xl">
            <div className="modal-header">
              <h2 className="text-base font-semibold">Nova pessoa</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setCreateKind(null);
                  setCreatePersonOrganizationId("");
                  setCreatePersonRoleId("");
                }}
              >
                Fechar
              </button>
            </div>
            <form
              className="modal-body grid gap-3 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await submitCreateForm(
                  "/api/organograma/create/person",
                  new FormData(event.currentTarget),
                  "Pessoa criada com sucesso.",
                );
              }}
            >
              <label className="text-xs font-medium text-[var(--muted)]">
                Nome
                <input name="name" required className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                E-mail
                <input name="email" type="email" className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Telefone
                <input name="phone" className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Status
                <select
                  name="active"
                  defaultValue="true"
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Organizacao para vinculo
                <select
                  name="organization_id_filter"
                  value={createPersonOrganizationId}
                  onChange={(event) => {
                    setCreatePersonOrganizationId(event.target.value);
                    setCreatePersonRoleId("");
                  }}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                >
                  <option value="">Todas as organizacoes</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Cargo inicial
                <select
                  name="role_id"
                  value={createPersonRoleId}
                  onChange={(event) => setCreatePersonRoleId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                >
                  <option value="">Sem cargo</option>
                  {rolesFilteredForCreatePerson.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} - {organizationNameById.get(role.organization_id) || "Organizacao"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Inicio do vinculo
                <input
                  name="start_date"
                  type="date"
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-[var(--muted)] md:col-span-2">
                Fim do vinculo
                <input
                  name="end_date"
                  type="date"
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                />
              </label>
              <div className="modal-actions md:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

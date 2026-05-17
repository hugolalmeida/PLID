"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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

type ViewMode = "ward" | "overview" | "detailed";
type CreateKind = "organization" | "role" | "person" | null;
type OverviewDensity = "compact" | "comfortable";
type AssignmentMode = "existing" | "new";

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

type DirectoryEntry = {
  link: PersonRoleRow;
  person: PersonRow;
  role: RoleRow;
  organization: OrganizationRow | null;
};

type BishopricRole = "bishop" | "firstCounselor" | "secondCounselor";

type WardSlot = {
  key: string;
  label: string;
  role: RoleRow | null;
  link: PersonRoleRow | null;
  person: PersonRow | null;
};

type WardOrganizationGroup = {
  supervisor: BishopricRole;
  organization: OrganizationRow;
  label: string;
  slots: WardSlot[];
};

const WARD_SUPERVISION: Array<{
  supervisor: BishopricRole;
  organizationNames: string[];
}> = [
  { supervisor: "bishop", organizationNames: ["Mocas", "Primaria"] },
  { supervisor: "firstCounselor", organizationNames: ["Sociedade de Socorro"] },
  {
    supervisor: "secondCounselor",
    organizationNames: [
      "Escola Dominical",
      "Quorum de Elderes",
      "Quoruns do Sacerdocio Aaronico",
    ],
  },
];

const BISHOPRIC_ROLE_OPTIONS: Array<{ value: BishopricRole; label: string }> = [
  { value: "bishop", label: "Bispo" },
  { value: "firstCounselor", label: "1o Conselheiro" },
  { value: "secondCounselor", label: "2o Conselheiro" },
];

const WARD_ORGANIZATION_ORDER = new Map<string, number>();
WARD_SUPERVISION.flatMap((supervision) => supervision.organizationNames).forEach(
  (name, index) => {
    WARD_ORGANIZATION_ORDER.set(normalizeForSearch(name), index);
  },
);

const DEFAULT_SUPERVISOR_BY_ORGANIZATION = new Map<string, BishopricRole>();
for (const supervision of WARD_SUPERVISION) {
  for (const organizationName of supervision.organizationNames) {
    DEFAULT_SUPERVISOR_BY_ORGANIZATION.set(
      normalizeForSearch(organizationName),
      supervision.supervisor,
    );
  }
}

const WARD_ROLE_SLOTS = [
  { key: "president", label: "Presidente", aliases: ["presidente", "presidencia"] },
  {
    key: "firstCounselor",
    label: "1o Conselheiro",
    aliases: ["1 conselheiro", "1o conselheiro", "primeiro conselheiro"],
  },
  {
    key: "secondCounselor",
    label: "2o Conselheiro",
    aliases: ["2 conselheiro", "2o conselheiro", "segundo conselheiro"],
  },
];

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, "")
    .toLowerCase();
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return `${first}${last}`.toUpperCase();
}

function identifyBishopricRole(roleName: string): BishopricRole | null {
  const normalized = normalizeForSearch(roleName);

  if (/\b(1|1o|1a|primeiro|primeira)\b/.test(normalized) && normalized.includes("conselheiro")) {
    return "firstCounselor";
  }
  if (/\b(2|2o|2a|segundo|segunda)\b/.test(normalized) && normalized.includes("conselheiro")) {
    return "secondCounselor";
  }
  if (/\bbispo\b/.test(normalized)) {
    return "bishop";
  }

  return null;
}

function bishopricLabel(role: BishopricRole) {
  if (role === "bishop") return "Bispo";
  if (role === "firstCounselor") return "1o Conselheiro";
  return "2o Conselheiro";
}

function organizationDisplayName(name: string) {
  const normalized = normalizeForSearch(name);
  if (normalized === "mocas") return "Mocas";
  if (normalized === "primaria") return "Primaria";
  if (normalized === "quorum de elderes") return "Quorum de Elderes";
  if (normalized === "quoruns do sacerdocio aaronico") {
    return "Quoruns do Sacerdocio Aaronico";
  }
  return name;
}

function isBishopricOrganizationName(name: string) {
  return normalizeForSearch(name) === "bispado";
}

function supervisorFromResponsibilities(value: string | null) {
  if (!value) return null;

  const normalized = normalizeForSearch(value);
  const supervisionIndex = normalized.lastIndexOf("supervisao");
  if (supervisionIndex < 0) return null;

  const supervisionText = normalized.slice(supervisionIndex);
  if (supervisionText.includes("bispo")) return "bishop";
  if (
    /\b(1|1o|primeiro|primeira)\b/.test(supervisionText) &&
    supervisionText.includes("conselheiro")
  ) {
    return "firstCounselor";
  }
  if (
    /\b(2|2o|segundo|segunda)\b/.test(supervisionText) &&
    supervisionText.includes("conselheiro")
  ) {
    return "secondCounselor";
  }

  return null;
}

function inferOrganizationSupervisor(organization: OrganizationRow, roles: RoleRow[]) {
  for (const role of roles) {
    const supervisor = supervisorFromResponsibilities(role.responsibilities);
    if (supervisor) return supervisor;
  }

  return (
    DEFAULT_SUPERVISOR_BY_ORGANIZATION.get(normalizeForSearch(organization.name)) || "bishop"
  );
}

function roleMatchesAliases(roleName: string, aliases: string[]) {
  const normalized = normalizeForSearch(roleName);
  return aliases.some((alias) => normalized.includes(normalizeForSearch(alias)));
}

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

function WardSlotCard({
  slot,
  compact = false,
  selected,
  onSelect,
  canManage,
  onAssign,
  onRemove,
}: {
  slot: WardSlot;
  compact?: boolean;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  canManage: boolean;
  onAssign: (slot: WardSlot) => void;
  onRemove: (slot: WardSlot) => void;
}) {
  const targetSelection: Selection = slot.link
    ? { kind: "personRole", id: slot.link.id }
    : slot.role
      ? { kind: "role", id: slot.role.id }
      : null;
  const isSelected =
    (selected?.kind === "personRole" && slot.link && selected.id === slot.link.id) ||
    (selected?.kind === "role" && slot.role && selected.id === slot.role.id);

  return (
    <div
      className={`w-full rounded-lg border transition ${
        isSelected
          ? "border-[#1f6f78] bg-[#e5f2f1]"
          : "border-[#d8e0e4] bg-white hover:border-[#93bdc1] hover:bg-[#f8fbfb]"
      } ${compact ? "p-2" : "p-2.5"} ${!slot.role ? "border-dashed bg-[#f8f4ee]" : ""}`}
    >
      <button
        type="button"
        disabled={!targetSelection}
        onClick={() => targetSelection && onSelect(targetSelection)}
        className="w-full text-left disabled:cursor-default"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#527075]">
          {slot.label}
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f6f78] text-xs font-semibold text-white">
            {slot.person ? initialsFromName(slot.person.name) : "+"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#172a2f]">
              {slot.person?.name || "Sem pessoa"}
            </span>
            <span className="muted-text block truncate text-xs">
              {slot.role?.name || "Cargo não criado"}
            </span>
          </span>
        </span>
      </button>
      {canManage ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#edf0f1] pt-2">
          <button
            type="button"
            disabled={!slot.role}
            onClick={() => onAssign(slot)}
            className="rounded-md border border-[#cbd8dc] bg-white px-2 py-1 text-[11px] font-medium text-[#1f6f78] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {slot.person ? "Trocar" : "Adicionar"}
          </button>
          {slot.link ? (
            <button
              type="button"
              onClick={() => onRemove(slot)}
              className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700"
            >
              Remover
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WardModelBoard({
  bishopricSlots,
  groups,
  selected,
  onSelect,
  onSelectOrganization,
  canManage,
  onAssignSlot,
  onRemoveSlot,
  onChangeSupervisor,
  onCreateDefaultRoles,
  updatingSupervisorOrgId,
  creatingDefaultRolesOrgId,
  scale,
  viewportRef,
  isPanning,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
}: {
  bishopricSlots: WardSlot[];
  groups: WardOrganizationGroup[];
  selected: Selection;
  onSelect: (selection: Selection) => void;
  onSelectOrganization: (organization: OrganizationRow) => void;
  canManage: boolean;
  onAssignSlot: (slot: WardSlot) => void;
  onRemoveSlot: (slot: WardSlot) => void;
  onChangeSupervisor: (organization: OrganizationRow, supervisor: BishopricRole) => void;
  onCreateDefaultRoles: (organization: OrganizationRow, supervisor: BishopricRole) => void;
  updatingSupervisorOrgId: string;
  creatingDefaultRolesOrgId: string;
  scale: number;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  isPanning: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const groupsBySupervisor = new Map<BishopricRole, WardOrganizationGroup[]>();
  for (const group of groups) {
    const current = groupsBySupervisor.get(group.supervisor) || [];
    current.push(group);
    groupsBySupervisor.set(group.supervisor, current);
  }

  const canvasStyle = {
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: `${100 / scale}%`,
  };

  return (
    <div
      ref={viewportRef}
      className={`mt-4 overflow-auto rounded-xl border border-[var(--line)] bg-[#f3f6f6] p-4 ${
        isPanning ? "cursor-grabbing select-none" : "cursor-grab"
      }`}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
    >
      <div className="mx-auto min-w-[980px] max-w-[1180px]" style={canvasStyle}>
        <div className="rounded-2xl border border-[#c6d6da] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-[#e3e8ea] pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1f6f78]">
                Modelo de Ala
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#172a2f]">Bispado</h3>
            </div>
            <p className="max-w-md text-right text-xs text-[var(--muted)]">
              As organizações abaixo são agrupadas pelo membro do bispado que as supervisiona.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            {bishopricSlots.map((slot) => {
              const supervisor = slot.key as BishopricRole;
              const supervisedGroups = groupsBySupervisor.get(supervisor) || [];

              return (
                <section key={slot.key} className="min-w-0">
                  <WardSlotCard
                    slot={slot}
                    selected={selected}
                    onSelect={onSelect}
                    canManage={canManage}
                    onAssign={onAssignSlot}
                    onRemove={onRemoveSlot}
                  />

                  <div className="mx-auto h-8 w-px bg-[#a7bdc2]" />
                  <div className="space-y-3">
                    {supervisedGroups.map((group) => (
                      <article
                        key={group.organization.id}
                        className="rounded-xl border border-[#d8e0e4] bg-[#fbfdfd] p-3 shadow-sm"
                      >
                        {(() => {
                          const missingRoles = group.slots.filter((slotItem) => !slotItem.role);
                          const isCreatingRoles =
                            creatingDefaultRolesOrgId === group.organization.id ||
                            creatingDefaultRolesOrgId === "__all__";

                          return (
                            <>
                        <button
                          type="button"
                          onClick={() => onSelectOrganization(group.organization)}
                          className={`w-full rounded-lg border px-3 py-2 text-left ${
                            selected?.kind === "organization" &&
                            selected.id === group.organization.id
                              ? "border-[#1f6f78] bg-[#e5f2f1]"
                              : "border-[#d8e0e4] bg-white"
                          }`}
                        >
                          <span className="block text-sm font-semibold text-[#172a2f]">
                            {group.label}
                          </span>
                          <span className="muted-text mt-0.5 block text-xs">
                            Presidência da organização
                          </span>
                        </button>

                        {canManage ? (
                          <label className="mt-2 block text-[11px] font-medium text-[#52666c]">
                            Supervisao
                            <select
                              value={group.supervisor}
                              disabled={updatingSupervisorOrgId === group.organization.id}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                onChangeSupervisor(
                                  group.organization,
                                  event.target.value as BishopricRole,
                                )
                              }
                              className="mt-1 w-full rounded-md border border-[#cfd9dc] bg-white px-2 py-1.5 text-xs text-[#172a2f]"
                            >
                              {BISHOPRIC_ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <p className="muted-text mt-2 text-[11px]">
                            Supervisao: {bishopricLabel(group.supervisor)}
                          </p>
                        )}

                        {canManage && missingRoles.length ? (
                          <button
                            type="button"
                            disabled={isCreatingRoles}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              onCreateDefaultRoles(group.organization, group.supervisor);
                            }}
                            className="mt-2 w-full rounded-md border border-[#cbd8dc] bg-white px-2 py-1.5 text-xs font-semibold text-[#1f6f78] disabled:opacity-60"
                          >
                            {isCreatingRoles
                              ? "Criando cargos..."
                              : `Criar ${missingRoles.length} cargo${
                                  missingRoles.length > 1 ? "s" : ""
                                } padrão`}
                          </button>
                        ) : null}

                        <div className="mt-2 grid gap-2">
                          {group.slots.map((slotItem) => (
                            <WardSlotCard
                              key={`${group.label}-${slotItem.key}`}
                              slot={slotItem}
                              compact
                              selected={selected}
                              onSelect={onSelect}
                              canManage={canManage}
                              onAssign={onAssignSlot}
                              onRemove={onRemoveSlot}
                            />
                          ))}
                        </div>
                            </>
                          );
                        })()}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
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

type ImportIssue = {
  row: number;
  message: string;
};

type ImportSummary = {
  processedRows: number;
  createdOrganizations: number;
  createdRoles: number;
  createdPeople: number;
  createdLinks: number;
  skippedRows: number;
  issues: ImportIssue[];
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
  const [viewMode, setViewMode] = useState<ViewMode>("ward");
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [overviewDensity, setOverviewDensity] = useState<OverviewDensity>("compact");
  const [fitToScreen, setFitToScreen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [assignmentSlot, setAssignmentSlot] = useState<WardSlot | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("existing");
  const [assignmentPersonId, setAssignmentPersonId] = useState("");
  const [assignmentNewName, setAssignmentNewName] = useState("");
  const [assignmentNewEmail, setAssignmentNewEmail] = useState("");
  const [assignmentNewPhone, setAssignmentNewPhone] = useState("");
  const [assignmentNewActive, setAssignmentNewActive] = useState(true);
  const [assignmentStartDate, setAssignmentStartDate] = useState("");
  const [assignmentEndDate, setAssignmentEndDate] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [isAssigningPerson, setIsAssigningPerson] = useState(false);
  const [updatingSupervisorOrgId, setUpdatingSupervisorOrgId] = useState("");
  const [creatingDefaultRolesOrgId, setCreatingDefaultRolesOrgId] = useState("");
  const [editingOrganization, setEditingOrganization] = useState<OrganizationRow | null>(null);
  const [organizationEditError, setOrganizationEditError] = useState("");
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [deletingOrganizationId, setDeletingOrganizationId] = useState("");
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

  const directoryEntries = useMemo<DirectoryEntry[]>(() => {
    return personRoles
      .map((link) => {
        const person = personById.get(link.person_id);
        const role = roleById.get(link.role_id);
        if (!person || !role) return null;

        return {
          link,
          person,
          role,
          organization: organizationById.get(role.organization_id) || null,
        };
      })
      .filter((entry): entry is DirectoryEntry => Boolean(entry))
      .sort((a, b) => a.person.name.localeCompare(b.person.name, "pt-BR"));
  }, [personRoles, personById, roleById, organizationById]);

  const filteredDirectoryEntries = useMemo(() => {
    const query = normalizeForSearch(searchQuery.trim());
    if (!query) return directoryEntries;

    return directoryEntries.filter((entry) => {
      const haystack = normalizeForSearch(
        [
          entry.person.name,
          entry.person.email || "",
          entry.person.phone || "",
          entry.role.name,
          entry.organization?.name || "",
          entry.organization?.type || "",
        ].join(" "),
      );

      return haystack.includes(query);
    });
  }, [directoryEntries, searchQuery]);

  const buildSlotForRole = useCallback(
    (input: {
      key: string;
      label: string;
      role: RoleRow | null;
    }): WardSlot => {
      const link = input.role ? (personRolesByRole.get(input.role.id) || [])[0] || null : null;
      const person = link ? personById.get(link.person_id) || null : null;

      return {
        key: input.key,
        label: input.label,
        role: input.role,
        link,
        person,
      };
    },
    [personById, personRolesByRole],
  );

  const bishopricSlots = useMemo<WardSlot[]>(() => {
    const bishopricOrganization = organizations.find(
      (organization) => normalizeForSearch(organization.name) === "bispado",
    );
    const bishopricRoles = bishopricOrganization
      ? rolesByOrg.get(bishopricOrganization.id) || []
      : [];

    return (["bishop", "firstCounselor", "secondCounselor"] as const).map((slotKey) => {
      const role =
        bishopricRoles.find((candidate) => identifyBishopricRole(candidate.name) === slotKey) ||
        null;

      return buildSlotForRole({
        key: slotKey,
        label: bishopricLabel(slotKey),
        role,
      });
    });
  }, [organizations, rolesByOrg, buildSlotForRole]);

  const wardOrganizationGroups = useMemo<WardOrganizationGroup[]>(() => {
    return organizations
      .filter((organization) => !isBishopricOrganizationName(organization.name))
      .sort((first, second) => {
        const firstOrder =
          WARD_ORGANIZATION_ORDER.get(normalizeForSearch(first.name)) ?? Number.MAX_SAFE_INTEGER;
        const secondOrder =
          WARD_ORGANIZATION_ORDER.get(normalizeForSearch(second.name)) ??
          Number.MAX_SAFE_INTEGER;

        if (firstOrder !== secondOrder) return firstOrder - secondOrder;
        return first.name.localeCompare(second.name, "pt-BR");
      })
      .map((organization) => {
        const organizationRoles = rolesByOrg.get(organization.id) || [];
        const slots = WARD_ROLE_SLOTS.map((slot) => {
          const role =
            organizationRoles.find((candidate) =>
              roleMatchesAliases(candidate.name, slot.aliases),
            ) || null;

          return buildSlotForRole({
            key: slot.key,
            label: slot.label,
            role,
          });
        });

        return {
          supervisor: inferOrganizationSupervisor(organization, organizationRoles),
          organization,
          label: organizationDisplayName(organization.name),
          slots,
        };
      });
  }, [organizations, rolesByOrg, buildSlotForRole]);

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
  const editOrganizationParentOptions = useMemo(() => {
    if (!editingOrganization) return organizations;

    const unavailableIds = collectDescendantIds(editingOrganization.id, childrenByParent);
    return organizations.filter((organization) => !unavailableIds.has(organization.id));
  }, [editingOrganization, organizations, childrenByParent]);

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
  const effectiveScale = Math.max(0.65, Math.min(1.45, fitScale * zoomLevel));
  const scaledCanvasStyle = {
    transform: `scale(${effectiveScale})`,
    transformOrigin: "top left",
    width: `${100 / effectiveScale}%`,
  };

  function changeZoom(delta: number) {
    setFitToScreen(false);
    setZoomLevel((current) =>
      Math.max(0.65, Math.min(1.45, Number((current + delta).toFixed(2)))),
    );
  }

  function resetZoom() {
    setFitToScreen(false);
    setZoomLevel(1);
  }

  function fitOverview() {
    setFitToScreen(true);
    setZoomLevel(1);
  }

  function selectDirectoryEntry(entry: DirectoryEntry) {
    setSelected({ kind: "personRole", id: entry.link.id });
    if (entry.organization) {
      setFocusOrganizationId(entry.organization.id);
    }
    setViewMode("ward");
  }

  function openAssignmentModal(slot: WardSlot) {
    if (!slot.role) {
      setCreateError("Aplique o modelo Ala para criar este cargo antes de atribuir uma pessoa.");
      return;
    }

    setAssignmentSlot(slot);
    setAssignmentMode(people.length ? "existing" : "new");
    setAssignmentPersonId(slot.person?.id || "");
    setAssignmentNewName("");
    setAssignmentNewEmail("");
    setAssignmentNewPhone("");
    setAssignmentNewActive(true);
    setAssignmentStartDate(slot.link?.start_date || "");
    setAssignmentEndDate(slot.link?.end_date || "");
    setAssignmentError("");
  }

  function closeAssignmentModal() {
    setAssignmentSlot(null);
    setAssignmentMode("existing");
    setAssignmentPersonId("");
    setAssignmentNewName("");
    setAssignmentNewEmail("");
    setAssignmentNewPhone("");
    setAssignmentNewActive(true);
    setAssignmentStartDate("");
    setAssignmentEndDate("");
    setAssignmentError("");
  }

  function openOrganizationEditor(organization: OrganizationRow) {
    setEditingOrganization(organization);
    setOrganizationEditError("");
    setSelected(null);
  }

  function closeOrganizationEditor() {
    setEditingOrganization(null);
    setOrganizationEditError("");
  }

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
          title: "Organização não encontrada",
          description: "Esse registro pode ter sido removido.",
        };
      }

      const parentName = organization.parent_id
        ? organizationById.get(organization.parent_id)?.name || "Não encontrado"
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
          `Organização pai: ${parentName}`,
          `Líder atual: ${leader?.person.name || "Não definido"}`,
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
          title: "Cargo não encontrado",
          description: "Esse registro pode ter sido removido.",
        };
      }

      const organizationName =
        organizationById.get(role.organization_id)?.name || "Não encontrado";
      const linkedPeople = personRolesByRole.get(role.id) || [];
      const person = linkedPeople.length ? personById.get(linkedPeople[0].person_id) : null;

      return {
        title: role.name,
        description: role.responsibilities || "Sem responsabilidades registradas.",
        lines: [
          `Organização: ${organizationName}`,
          `Pessoa vinculada: ${person?.name || "Não definida"}`,
          `E-mail: ${person?.email || "-"}`,
          `Telefone: ${person?.phone || "-"}`,
        ],
      };
    }

    const personRole = personRoles.find((item) => item.id === effectiveSelected.id);
    if (!personRole) {
      return {
        title: "Vínculo não encontrado",
        description: "Esse registro pode ter sido removido.",
      };
    }

    const person = personById.get(personRole.person_id);
    const role = roleById.get(personRole.role_id);

    return {
      title: person?.name || `Pessoa #${personRole.person_id.slice(0, 6)}`,
      description: role?.name || "Cargo não encontrado",
      lines: [
        `Início: ${formatDate(personRole.start_date)}`,
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
  const selectedOrganizationForActions =
    effectiveSelected?.kind === "organization"
      ? organizationById.get(effectiveSelected.id) || null
      : null;

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
        setCreateError(payload.error || "Não foi possível salvar.");
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

  async function submitImportForm(formData: FormData) {
    setIsImporting(true);
    setImportError("");
    setImportSummary(null);

    try {
      const response = await fetch("/api/organograma/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        summary?: ImportSummary;
      };

      if (!response.ok || !payload.ok || !payload.summary) {
        setImportError(payload.error || "Não foi possível importar o arquivo.");
        return;
      }

      setImportSummary(payload.summary);
      setCreateSuccess("Importação concluída.");
      setCreateError("");
      router.refresh();
    } catch {
      setImportError("Falha inesperada durante a importacao.");
    } finally {
      setIsImporting(false);
    }
  }

  async function applyWardTemplate() {
    setIsApplyingTemplate(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch("/api/organograma/apply-template/ward", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        summary?: { createdOrganizations: number; createdRoles: number };
      };

      if (!response.ok || !payload.ok) {
        setCreateError(payload.error || "Não foi possível aplicar o modelo.");
        return;
      }

      setCreateSuccess(
        `Modelo aplicado. Organizacoes criadas: ${
          payload.summary?.createdOrganizations || 0
        }. Cargos criados: ${payload.summary?.createdRoles || 0}.`,
      );
      setViewMode("ward");
      router.refresh();
    } catch {
      setCreateError("Falha inesperada ao aplicar o modelo.");
    } finally {
      setIsApplyingTemplate(false);
    }
  }

  async function createDefaultRoles(
    organization?: OrganizationRow,
    supervisor?: BishopricRole,
  ) {
    const targetId = organization?.id || "__all__";
    setCreatingDefaultRolesOrgId(targetId);
    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch("/api/organograma/create-default-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organization?.id,
          supervisor,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        summary?: { createdRoles: number };
      };

      if (!response.ok || !payload.ok) {
        setCreateError(payload.error || "Não foi possível criar os cargos padrão.");
        return;
      }

      const createdRoles = payload.summary?.createdRoles || 0;
      setCreateSuccess(
        organization
          ? `${createdRoles} cargo${createdRoles === 1 ? "" : "s"} criado${
              createdRoles === 1 ? "" : "s"
            } em ${organizationDisplayName(organization.name)}.`
          : `${createdRoles} cargo${createdRoles === 1 ? "" : "s"} padrão criado${
              createdRoles === 1 ? "" : "s"
            } no organograma.`,
      );
      router.refresh();
    } catch {
      setCreateError("Falha inesperada ao criar os cargos padrão.");
    } finally {
      setCreatingDefaultRolesOrgId("");
    }
  }

  async function submitOrganizationEdit(formData: FormData) {
    if (!editingOrganization) return;

    setIsSavingOrganization(true);
    setOrganizationEditError("");
    setCreateError("");
    setCreateSuccess("");
    formData.set("organization_id", editingOrganization.id);

    try {
      const response = await fetch("/api/organograma/update-organization", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setOrganizationEditError(payload.error || "Não foi possível editar a organização.");
        return;
      }

      setCreateSuccess("Organização atualizada.");
      closeOrganizationEditor();
      router.refresh();
    } catch {
      setOrganizationEditError("Falha inesperada ao editar organização.");
    } finally {
      setIsSavingOrganization(false);
    }
  }

  async function deleteOrganization(organization: OrganizationRow) {
    const confirmed = window.confirm(
      `Remover ${organization.name}? Os cargos e vínculos desta organização também serão removidos.`,
    );
    if (!confirmed) return;

    setDeletingOrganizationId(organization.id);
    setCreateError("");
    setCreateSuccess("");
    setSelected(null);

    try {
      const response = await fetch("/api/organograma/delete-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: organization.id }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setCreateError(payload.error || "Não foi possível remover a organização.");
        return;
      }

      setCreateSuccess("Organização removida.");
      if (focusOrganizationId === organization.id) {
        setFocusOrganizationId("");
      }
      router.refresh();
    } catch {
      setCreateError("Falha inesperada ao remover organização.");
    } finally {
      setDeletingOrganizationId("");
    }
  }

  async function submitAssignmentForm() {
    if (!assignmentSlot?.role) {
      setAssignmentError("Cargo não encontrado para esta posição.");
      return;
    }
    if (assignmentMode === "existing" && !assignmentPersonId) {
      setAssignmentError("Selecione uma pessoa.");
      return;
    }
    if (assignmentMode === "new" && !assignmentNewName.trim()) {
      setAssignmentError("Informe o nome da nova pessoa.");
      return;
    }

    setIsAssigningPerson(true);
    setAssignmentError("");
    setCreateError("");
    setCreateSuccess("");

    let personId = assignmentPersonId;

    if (assignmentMode === "new") {
      const personFormData = new FormData();
      personFormData.set("name", assignmentNewName);
      personFormData.set("email", assignmentNewEmail);
      personFormData.set("phone", assignmentNewPhone);
      personFormData.set("active", assignmentNewActive ? "true" : "false");

      try {
        const personResponse = await fetch("/api/organograma/create/person", {
          method: "POST",
          body: personFormData,
        });
        const personPayload = (await personResponse.json()) as {
          ok?: boolean;
          error?: string;
          person?: { id?: string };
        };

        if (!personResponse.ok || !personPayload.ok || !personPayload.person?.id) {
          setAssignmentError(personPayload.error || "Não foi possível criar a pessoa.");
          setIsAssigningPerson(false);
          return;
        }

        personId = personPayload.person.id;
      } catch {
        setAssignmentError("Falha inesperada ao criar pessoa.");
        setIsAssigningPerson(false);
        return;
      }
    }

    const formData = new FormData();
    formData.set("role_id", assignmentSlot.role.id);
    formData.set("person_id", personId);
    formData.set("start_date", assignmentStartDate);
    formData.set("end_date", assignmentEndDate);

    try {
      const response = await fetch("/api/organograma/assign-person", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setAssignmentError(payload.error || "Não foi possível atribuir a pessoa.");
        return;
      }

      setCreateSuccess(
        assignmentMode === "new"
          ? "Pessoa criada e atribuída ao cargo."
          : "Pessoa atribuída ao cargo.",
      );
      closeAssignmentModal();
      router.refresh();
    } catch {
      setAssignmentError("Falha inesperada ao atribuir pessoa.");
    } finally {
      setIsAssigningPerson(false);
    }
  }

  async function removeAssignment(slot: WardSlot) {
    if (!slot.link) return;

    const confirmed = window.confirm(
      `Remover ${slot.person?.name || "esta pessoa"} de ${slot.label}?`,
    );
    if (!confirmed) return;

    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch("/api/organograma/remove-person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_role_id: slot.link.id }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setCreateError(payload.error || "Não foi possível remover o vínculo.");
        return;
      }

      setCreateSuccess("Pessoa removida da posição.");
      setSelected(null);
      router.refresh();
    } catch {
      setCreateError("Falha inesperada ao remover pessoa.");
    }
  }

  async function updateOrganizationSupervisor(
    organization: OrganizationRow,
    supervisor: BishopricRole,
  ) {
    setUpdatingSupervisorOrgId(organization.id);
    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch("/api/organograma/update-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organization.id,
          supervisor,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setCreateError(payload.error || "Não foi possível trocar a supervisão.");
        return;
      }

      setCreateSuccess(
        `${organizationDisplayName(organization.name)} agora esta sob ${bishopricLabel(
          supervisor,
        )}.`,
      );
      router.refresh();
    } catch {
      setCreateError("Falha inesperada ao trocar a supervisao.");
    } finally {
      setUpdatingSupervisorOrgId("");
    }
  }

  return (
    <section className="mt-6">
      <article className="rounded-xl border border-[var(--line)] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Estrutura interativa</h2>
            <p className="muted-text mt-1 text-sm">
              Modelo Ala para preencher cargos, trocar supervisoes e manter a estrutura do workspace.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[#f8f4ee] p-1 text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={() => setViewMode("ward")}
              className={`rounded-md px-2.5 py-1 ${
                viewMode === "ward"
                  ? "bg-white font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)]"
              }`}
            >
              Modelo Ala
            </button>
            <button
              type="button"
              onClick={() => setViewMode("overview")}
              className={`rounded-md px-2.5 py-1 ${
                viewMode === "overview"
                  ? "bg-white font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)]"
              }`}
            >
              Geral
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
              Detalhada
            </button>
          </div>
          {viewMode === "ward" || viewMode === "overview" ? (
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
          {viewMode === "ward" || viewMode === "overview" ? (
            <div className="flex items-center rounded-lg border border-[var(--line)] bg-white p-1 text-xs">
              <button
                type="button"
                onClick={() => changeZoom(-0.1)}
                className="h-7 w-7 rounded-md font-semibold hover:bg-[#f8f4ee]"
                title="Diminuir zoom"
              >
                -
              </button>
              <span className="min-w-12 text-center font-medium">
                {Math.round(effectiveScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => changeZoom(0.1)}
                className="h-7 w-7 rounded-md font-semibold hover:bg-[#f8f4ee]"
                title="Aumentar zoom"
              >
                +
              </button>
              <button
                type="button"
                onClick={resetZoom}
                className="ml-1 rounded-md px-2 py-1 font-medium hover:bg-[#f8f4ee]"
              >
                100%
              </button>
              <button
                type="button"
                onClick={fitOverview}
                className="rounded-md px-2 py-1 font-medium hover:bg-[#f8f4ee]"
              >
                Ajustar
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setDirectoryOpen((state) => !state)}
            className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium"
          >
            {directoryOpen ? "Ocultar diretório" : "Diretório"}
          </button>
        </div>

        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void applyWardTemplate()}
              disabled={isApplyingTemplate}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {isApplyingTemplate ? "Aplicando..." : "Aplicar modelo Ala"}
            </button>
            <button
              type="button"
              onClick={() => void createDefaultRoles()}
              disabled={creatingDefaultRolesOrgId === "__all__"}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
            >
              {creatingDefaultRolesOrgId === "__all__"
                ? "Criando cargos..."
                : "Completar cargos padrão"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateKind("organization");
                setCreatePersonOrganizationId("");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
            >
              <span className="text-sm leading-none">+</span>
              Organização
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

        {canManage ? (
          <div className="mt-3 rounded-lg border border-[var(--line)] bg-[#f8f4ee] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                  Importação em lote
                </p>
                <p className="muted-text mt-1 text-xs">
                  Envie planilha `.csv`, `.xlsx` ou `.xls` para criar organizações, cargos, pessoas e vínculos.
                </p>
              </div>
              <a
                href="/templates/organograma-import-template.csv"
                download
                className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
              >
                Baixar template CSV
              </a>
            </div>
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await submitImportForm(formData);
              }}
            >
              <input
                type="file"
                name="file"
                accept=".csv,.xlsx,.xls"
                required
                className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={isImporting}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {isImporting ? "Importando..." : "Importar arquivo"}
              </button>
            </form>
            {importError ? (
              <p className="mt-2 text-xs font-medium text-red-700">{importError}</p>
            ) : null}
            {importSummary ? (
              <p className="mt-2 text-xs text-emerald-700">
                Processadas: {importSummary.processedRows}. Organizacoes: +
                {importSummary.createdOrganizations}. Cargos: +{importSummary.createdRoles}. Pessoas:
                +{importSummary.createdPeople}. Vinculos: +{importSummary.createdLinks}. Linhas ignoradas:{" "}
                {importSummary.skippedRows}.
                {importSummary.issues.length
                  ? ` Alertas: ${importSummary.issues
                      .slice(0, 3)
                      .map((issue) => `linha ${issue.row} (${issue.message})`)
                      .join(" | ")}${importSummary.issues.length > 3 ? " ..." : ""}`
                  : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {viewMode === "overview" ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-[var(--muted)]">
              Filtro por organização
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

        {directoryOpen ? (
          <aside className="mt-4 rounded-xl border border-[var(--line)] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[#f8f4ee] px-3 py-2">
              <div>
                <h3 className="text-sm font-semibold">Diretorio do organograma</h3>
                <p className="muted-text mt-0.5 text-xs">
                  Pessoas, cargos e organizações do workspace ativo.
                </p>
              </div>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar..."
                className="min-w-[220px] rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
                >
                  Limpar busca
                </button>
              ) : null}
            </div>
            <div className="grid max-h-[260px] gap-2 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredDirectoryEntries.length ? (
                filteredDirectoryEntries.map((entry) => (
                  <button
                    key={entry.link.id}
                    type="button"
                    onClick={() => selectDirectoryEntry(entry)}
                    className={`flex min-h-[92px] items-start gap-3 rounded-lg border p-3 text-left transition hover:border-[var(--accent)] hover:bg-[#f8f4ee] ${
                      effectiveSelected?.kind === "personRole" && effectiveSelected.id === entry.link.id
                        ? "border-[var(--accent)] bg-[#edf6f5]"
                        : "border-[var(--line)] bg-white"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1f6f78] text-sm font-semibold text-white">
                      {initialsFromName(entry.person.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{entry.person.name}</span>
                      <span className="muted-text mt-0.5 block truncate text-xs">{entry.role.name}</span>
                      <span className="muted-text mt-1 block truncate text-xs">
                        {entry.organization?.name || "Organização não encontrada"}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--line)] bg-[#fbfaf8] p-4 text-sm text-[var(--muted)] sm:col-span-2 xl:col-span-3">
                  Nenhum vínculo encontrado para a busca atual.
                </div>
              )}
            </div>
          </aside>
        ) : null}

        {organizations.length ? (
          viewMode === "ward" ? (
            <WardModelBoard
              bishopricSlots={bishopricSlots}
              groups={wardOrganizationGroups}
              selected={effectiveSelected}
              onSelect={setSelected}
              onSelectOrganization={(organization) =>
                setSelected({ kind: "organization", id: organization.id })
              }
              canManage={canManage}
              onAssignSlot={openAssignmentModal}
              onRemoveSlot={(slot) => void removeAssignment(slot)}
              onChangeSupervisor={(organization, supervisor) =>
                void updateOrganizationSupervisor(organization, supervisor)
              }
              onCreateDefaultRoles={(organization, supervisor) =>
                void createDefaultRoles(organization, supervisor)
              }
              updatingSupervisorOrgId={updatingSupervisorOrgId}
              creatingDefaultRolesOrgId={creatingDefaultRolesOrgId}
              scale={effectiveScale}
              viewportRef={treeViewportRef}
              isPanning={isPanning}
              onPointerDown={onTreePointerDown}
              onPointerMove={onTreePointerMove}
              onPointerUp={(event) => stopTreePan(event)}
              onPointerCancel={(event) => stopTreePan(event)}
              onPointerLeave={(event) => stopTreePan(event)}
            />
          ) : viewMode === "overview" ? (
            <div
              className="mx-auto mt-4 w-full max-w-[1280px] rounded-xl border border-[var(--line)] bg-[#dff2f1] p-2 sm:p-3 md:p-4"
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
                  style={scaledCanvasStyle}
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
          )
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[#fbfaf8] p-4">
            <h3 className="text-sm font-semibold">Organograma ainda vazio</h3>
            <p className="muted-text mt-1 text-sm">
              Use os botoes de criacao ou importe um arquivo para montar a estrutura.
            </p>
          </div>
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
              {canManage && selectedOrganizationForActions ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                  <button
                    type="button"
                    onClick={() => openOrganizationEditor(selectedOrganizationForActions)}
                    className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)]"
                  >
                    Editar organização
                  </button>
                  <button
                    type="button"
                    disabled={deletingOrganizationId === selectedOrganizationForActions.id}
                    onClick={() => void deleteOrganization(selectedOrganizationForActions)}
                    className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                  >
                    {deletingOrganizationId === selectedOrganizationForActions.id
                      ? "Removendo..."
                      : "Remover organização"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {editingOrganization ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Editar organização"
        >
          <div className="modal-card max-w-xl">
            <div className="modal-header">
              <h2 className="text-base font-semibold">Editar organização</h2>
              <button type="button" className="modal-close" onClick={closeOrganizationEditor}>
                Fechar
              </button>
            </div>
            <form
              className="modal-body grid gap-3 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await submitOrganizationEdit(new FormData(event.currentTarget));
              }}
            >
              <label className="text-xs font-medium text-[var(--muted)]">
                Nome
                <input
                  name="name"
                  required
                  defaultValue={editingOrganization.name}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Tipo
                <input
                  name="type"
                  required
                  defaultValue={editingOrganization.type}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-[var(--muted)] md:col-span-2">
                Organização pai
                <select
                  name="parent_id"
                  defaultValue={editingOrganization.parent_id || ""}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                >
                  <option value="">Raiz</option>
                  {editOrganizationParentOptions.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              {organizationEditError ? (
                <p className="text-xs font-medium text-red-700 md:col-span-2">
                  {organizationEditError}
                </p>
              ) : null}
              <div className="modal-actions md:col-span-2">
                <button
                  type="submit"
                  disabled={isSavingOrganization}
                  className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSavingOrganization ? "Salvando..." : "Salvar organização"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {assignmentSlot?.role ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Atribuir pessoa">
          <div className="modal-card max-w-lg">
            <div className="modal-header">
              <div>
                <h2 className="text-base font-semibold">
                  {assignmentSlot.person ? "Trocar pessoa" : "Adicionar pessoa"}
                </h2>
                <p className="muted-text mt-1 text-xs">
                  {assignmentSlot.label} - {assignmentSlot.role.name}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeAssignmentModal}>
                Fechar
              </button>
            </div>
            <form
              className="modal-body grid gap-3 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await submitAssignmentForm();
              }}
            >
              <div className="md:col-span-2">
                <div className="inline-flex rounded-lg border border-[var(--line)] bg-[#f8f4ee] p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setAssignmentMode("existing")}
                    disabled={!people.length}
                    className={`rounded-md px-2.5 py-1 ${
                      assignmentMode === "existing"
                        ? "bg-white font-semibold text-[var(--accent)]"
                        : "text-[var(--muted)]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Pessoa existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignmentMode("new")}
                    className={`rounded-md px-2.5 py-1 ${
                      assignmentMode === "new"
                        ? "bg-white font-semibold text-[var(--accent)]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Nova pessoa
                  </button>
                </div>
              </div>

              {assignmentMode === "existing" ? (
                <label className="text-xs font-medium text-[var(--muted)] md:col-span-2">
                  Pessoa
                  <select
                    required
                    value={assignmentPersonId}
                    onChange={(event) => setAssignmentPersonId(event.target.value)}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    <option value="">Selecione</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                        {person.active ? "" : " (inativo)"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="text-xs font-medium text-[var(--muted)] md:col-span-2">
                    Nome
                    <input
                      required
                      value={assignmentNewName}
                      onChange={(event) => setAssignmentNewName(event.target.value)}
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-[var(--muted)]">
                    Email
                    <input
                      type="email"
                      value={assignmentNewEmail}
                      onChange={(event) => setAssignmentNewEmail(event.target.value)}
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-[var(--muted)]">
                    Telefone
                    <input
                      value={assignmentNewPhone}
                      onChange={(event) => setAssignmentNewPhone(event.target.value)}
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)] md:col-span-2">
                    <input
                      type="checkbox"
                      checked={assignmentNewActive}
                      onChange={(event) => setAssignmentNewActive(event.target.checked)}
                      className="h-4 w-4"
                    />
                    Pessoa ativa
                  </label>
                </>
              )}
              <label className="text-xs font-medium text-[var(--muted)]">
                Início do vínculo
                <input
                  type="date"
                  value={assignmentStartDate}
                  onChange={(event) => setAssignmentStartDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Fim do vínculo
                <input
                  type="date"
                  value={assignmentEndDate}
                  onChange={(event) => setAssignmentEndDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                />
              </label>
              {assignmentError ? (
                <p className="text-xs font-medium text-red-700 md:col-span-2">
                  {assignmentError}
                </p>
              ) : null}
              {!people.length ? (
                <p className="muted-text text-xs md:col-span-2">
                  Nenhuma pessoa cadastrada ainda. Use a opção Nova pessoa para preencher esta posição.
                </p>
              ) : null}
              <div className="modal-actions md:col-span-2">
                <button
                  type="submit"
                  disabled={isAssigningPerson}
                  className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isAssigningPerson ? "Salvando..." : "Salvar vínculo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {createKind === "organization" ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Nova organização">
          <div className="modal-card max-w-xl">
            <div className="modal-header">
              <h2 className="text-base font-semibold">Nova organização</h2>
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
                  "Organização criada com sucesso.",
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
                Organização pai
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
                Organização
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
                Organização para vínculo
                <select
                  name="organization_id_filter"
                  value={createPersonOrganizationId}
                  onChange={(event) => {
                    setCreatePersonOrganizationId(event.target.value);
                    setCreatePersonRoleId("");
                  }}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                >
                  <option value="">Todas as organizações</option>
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
                      {role.name} - {organizationNameById.get(role.organization_id) || "Organização"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">
                Início do vínculo
                <input
                  name="start_date"
                  type="date"
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-[var(--muted)] md:col-span-2">
                Fim do vínculo
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

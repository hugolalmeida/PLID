"use client";

import { useMemo, useState } from "react";
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

type BranchProps = {
  organization: OrganizationRow;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  childrenByParent: Map<string, OrganizationRow[]>;
  rolesByOrg: Map<string, RoleRow[]>;
  personRolesByRole: Map<string, PersonRoleRow[]>;
  personById: Map<string, PersonRow>;
};

function formatDate(date: string | null) {
  return date || "-";
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

type OrganogramaClientProps = {
  organizations: OrganizationRow[];
  roles: RoleRow[];
  personRoles: PersonRoleRow[];
  people: PersonRow[];
};

export function OrganogramaClient({
  organizations,
  roles,
  personRoles,
  people,
}: OrganogramaClientProps) {
  const [selected, setSelected] = useState<Selection>(
    organizations[0] ? { kind: "organization", id: organizations[0].id } : null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("overview");

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

  const levels = useMemo(
    () => buildLevels(rootOrganizations, childrenByParent),
    [rootOrganizations, childrenByParent],
  );

  const effectiveSelected = useMemo<Selection>(() => {
    if (!selected) {
      return rootOrganizations[0]
        ? { kind: "organization", id: rootOrganizations[0].id }
        : null;
    }

    if (selected.kind === "organization") {
      return organizationById.has(selected.id)
        ? selected
        : rootOrganizations[0]
          ? { kind: "organization", id: rootOrganizations[0].id }
          : null;
    }

    if (selected.kind === "role") {
      return roleById.has(selected.id)
        ? selected
        : rootOrganizations[0]
          ? { kind: "organization", id: rootOrganizations[0].id }
          : null;
    }

    return personRoles.find((item) => item.id === selected.id)
      ? selected
      : rootOrganizations[0]
        ? { kind: "organization", id: rootOrganizations[0].id }
        : null;
  }, [selected, rootOrganizations, organizationById, roleById, personRoles]);

  const details = useMemo(() => {
    if (!effectiveSelected) {
      return {
        title: "Selecione um item",
        description: "Clique em uma organizacao, cargo ou pessoa para ver os detalhes.",
      };
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
      const childrenCount = (childrenByParent.get(organization.id) || []).length;
      const rolesCount = (rolesByOrg.get(organization.id) || []).length;

      return {
        title: organization.name,
        description: organization.type,
        lines: [
          `Organizacao pai: ${parentName}`,
          `Suborganizacoes: ${childrenCount}`,
          `Cargos nesta organizacao: ${rolesCount}`,
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

      return {
        title: role.name,
        description: role.responsibilities || "Sem responsabilidades registradas.",
        lines: [
          `Organizacao: ${organizationName}`,
          `Pessoas vinculadas: ${linkedPeople.length}`,
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
    childrenByParent,
    rolesByOrg,
    roleById,
    personRolesByRole,
    personRoles,
    personById,
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

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <article className="rounded-xl border border-[var(--line)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Estrutura interativa</h2>
            <p className="muted-text mt-1 text-sm">
              Modo geral para visao completa e modo detalhado para navegacao por clique.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[#f8f4ee] p-1 text-xs">
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
        </div>

        {viewMode === "overview" ? (
          <div className="mt-4 space-y-3">
            {levels.map((levelOrganizations, levelIndex) => (
              <div key={`level-${levelIndex}`}>
                {levelIndex > 0 ? (
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="h-px flex-1 bg-[var(--line)]" />
                    <span>ramificacao</span>
                    <span className="h-px flex-1 bg-[var(--line)]" />
                  </div>
                ) : null}
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                  Nivel {levelIndex + 1}
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {levelOrganizations.map((organization) => {
                    const orgRoles = rolesByOrg.get(organization.id) || [];
                    const linkedPeopleNames = new Set<string>();

                    orgRoles.forEach((role) => {
                      const links = personRolesByRole.get(role.id) || [];
                      links.forEach((link) => {
                        const person = personById.get(link.person_id);
                        if (person) {
                          linkedPeopleNames.add(person.name);
                        }
                      });
                    });

                    return (
                      <button
                        key={organization.id}
                        type="button"
                        onClick={() => setSelected({ kind: "organization", id: organization.id })}
                        className={`rounded-lg border p-3 text-left transition ${
                          effectiveSelected?.kind === "organization" &&
                          effectiveSelected.id === organization.id
                            ? "border-[var(--accent)] bg-[#edf6f5]"
                            : "border-[var(--line)] bg-white hover:bg-[#faf7f2]"
                        }`}
                      >
                        <p className="text-sm font-semibold">{organization.name}</p>
                        <p className="muted-text text-xs">{organization.type}</p>
                        <div className="mt-2 text-xs text-[var(--muted)]">
                          <p>Cargos: {orgRoles.length}</p>
                          <p>Pessoas vinculadas: {linkedPeopleNames.size}</p>
                        </div>
                        {linkedPeopleNames.size ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Array.from(linkedPeopleNames)
                              .slice(0, 3)
                              .map((name) => (
                                <span
                                  key={name}
                                  className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[11px]"
                                >
                                  {name}
                                </span>
                              ))}
                            {linkedPeopleNames.size > 3 ? (
                              <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[11px]">
                                +{linkedPeopleNames.size - 3}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-3">
            {rootOrganizations.map((organization) => (
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

      <aside className="rounded-xl border border-[var(--line)] bg-white p-4">
        <h2 className="text-base font-semibold">Detalhes</h2>
        <h3 className="mt-3 text-sm font-semibold">{details.title}</h3>
        <p className="muted-text mt-1 text-sm">{details.description}</p>
        {"lines" in details && details.lines?.length ? (
          <ul className="muted-text mt-3 space-y-1 text-sm">
            {details.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </aside>
    </section>
  );
}

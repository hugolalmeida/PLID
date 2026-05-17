import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

type ParsedImportRow = {
  rowNumber: number;
  organizationName: string;
  organizationType: string;
  parentOrganizationName: string;
  parentOrganizationType: string;
  roleName: string;
  roleResponsibilities: string;
  personName: string;
  personEmail: string;
  personPhone: string;
  personActive: string;
  linkStartDate: string;
  linkEndDate: string;
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

type OrganizationRecord = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type RoleRecord = {
  id: string;
  name: string;
  organization_id: string;
};

type PersonRecord = {
  id: string;
  name: string;
  email: string | null;
};

type PersonRoleRecord = {
  id: string;
  person_id: string;
  role_id: string;
};

const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);
const MAX_ISSUES = 40;

const HEADER_ALIASES: Record<string, string[]> = {
  organization_name: ["organization_name", "organizacao", "organizacao_nome", "org_name"],
  organization_type: ["organization_type", "tipo_organizacao", "org_type"],
  parent_organization_name: [
    "parent_organization_name",
    "organizacao_pai",
    "organizacao_pai_nome",
    "parent_org",
  ],
  parent_organization_type: [
    "parent_organization_type",
    "tipo_organizacao_pai",
    "parent_org_type",
  ],
  role_name: ["role_name", "cargo", "cargo_nome"],
  role_responsibilities: [
    "role_responsibilities",
    "responsibilities",
    "responsabilidades",
  ],
  person_name: ["person_name", "pessoa", "pessoa_nome", "nome_pessoa"],
  person_email: ["person_email", "email", "email_pessoa"],
  person_phone: ["person_phone", "telefone", "phone", "telefone_pessoa"],
  person_active: ["person_active", "ativo", "status_ativo"],
  link_start_date: ["link_start_date", "inicio_vinculo", "start_date"],
  link_end_date: ["link_end_date", "fim_vinculo", "end_date"],
};

const REQUIRED_TEMPLATE_COLUMNS = [
  "organization_name",
  "organization_type",
  "parent_organization_name",
  "parent_organization_type",
  "role_name",
  "role_responsibilities",
  "person_name",
  "person_email",
  "person_phone",
  "person_active",
  "link_start_date",
  "link_end_date",
];

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeKey(value: string) {
  return normalizeText(value).replace(/_/g, " ").trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseBoolean(value: string, fallback = true) {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  if (["1", "true", "sim", "yes", "ativo", "active"].includes(normalized)) return true;
  if (["0", "false", "nao", "nao_", "no", "inativo", "inactive"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseDate(value: string) {
  const raw = value.trim();
  if (!raw) {
    return { value: null as string | null, error: "" };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { value: raw, error: "" };
  }

  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    const converted = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    return { value: converted, error: "" };
  }

  return {
    value: null,
    error: `Data invalida "${value}". Use YYYY-MM-DD ou DD/MM/YYYY.`,
  };
}

function buildColumnMap(headerRow: string[]) {
  const normalizedHeaders = headerRow.map((header) => normalizeText(header));
  const map = new Map<string, number>();

  Object.entries(HEADER_ALIASES).forEach(([canonical, aliases]) => {
    const foundIndex = aliases
      .map((alias) => normalizedHeaders.indexOf(normalizeText(alias)))
      .find((index) => index >= 0);
    if (typeof foundIndex === "number" && foundIndex >= 0) {
      map.set(canonical, foundIndex);
    }
  });

  return map;
}

function parseRowsFromSheet(rows: Array<Array<string | number>>) {
  const headerRow = rows[0]?.map((cell) => String(cell ?? "")) || [];
  const columnMap = buildColumnMap(headerRow);
  const recognizedColumns = Array.from(columnMap.keys());

  if (!recognizedColumns.length) {
    return {
      parsedRows: [] as ParsedImportRow[],
      error:
        "Cabecalho nao reconhecido. Use o template CSV para manter os nomes das colunas esperados.",
    };
  }

  const parsedRows: ParsedImportRow[] = [];

  const readCell = (line: Array<string | number>, key: string) => {
    const index = columnMap.get(key);
    if (typeof index !== "number") return "";
    const cell = line[index];
    return String(cell ?? "").trim();
  };

  rows.slice(1).forEach((line, index) => {
    const parsed: ParsedImportRow = {
      rowNumber: index + 2,
      organizationName: readCell(line, "organization_name"),
      organizationType: readCell(line, "organization_type"),
      parentOrganizationName: readCell(line, "parent_organization_name"),
      parentOrganizationType: readCell(line, "parent_organization_type"),
      roleName: readCell(line, "role_name"),
      roleResponsibilities: readCell(line, "role_responsibilities"),
      personName: readCell(line, "person_name"),
      personEmail: readCell(line, "person_email"),
      personPhone: readCell(line, "person_phone"),
      personActive: readCell(line, "person_active"),
      linkStartDate: readCell(line, "link_start_date"),
      linkEndDate: readCell(line, "link_end_date"),
    };

    const hasAnyValue = Object.entries(parsed).some(([key, value]) => {
      if (key === "rowNumber") return false;
      return Boolean(value);
    });

    if (hasAnyValue) {
      parsedRows.push(parsed);
    }
  });

  return { parsedRows, error: "" };
}

function pushIssue(issues: ImportIssue[], issue: ImportIssue) {
  if (issues.length < MAX_ISSUES) {
    issues.push(issue);
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace ativo nao encontrado." },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo obrigatorio. Envie um CSV ou Excel." },
      { status: 400 },
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: "Formato nao suportado. Use .csv, .xlsx ou .xls." },
      { status: 400 },
    );
  }

  let rows: Array<Array<string | number>> = [];

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      raw: false,
    });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "Arquivo sem abas validas." }, { status: 400 });
    }
    const firstSheet = workbook.Sheets[firstSheetName];
    rows = XLSX.utils.sheet_to_json<Array<string | number>>(firstSheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel ler o arquivo enviado." },
      { status: 400 },
    );
  }

  if (rows.length < 2) {
    return NextResponse.json(
      { error: "Arquivo vazio. Inclua cabecalho e pelo menos uma linha de dados." },
      { status: 400 },
    );
  }

  const { parsedRows, error: parseError } = parseRowsFromSheet(rows);
  if (parseError) {
    return NextResponse.json(
      {
        error: `${parseError} Colunas esperadas: ${REQUIRED_TEMPLATE_COLUMNS.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  if (!parsedRows.length) {
    return NextResponse.json(
      { error: "Nao ha linhas validas para importar." },
      { status: 400 },
    );
  }

  const [organizationsResult, rolesResult, peopleResult, personRolesResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, type, parent_id")
        .eq("workspace_id", workspaceId)
        .returns<OrganizationRecord[]>(),
      supabase
        .from("roles")
        .select("id, name, organization_id")
        .eq("workspace_id", workspaceId)
        .returns<RoleRecord[]>(),
      supabase
        .from("people")
        .select("id, name, email")
        .eq("workspace_id", workspaceId)
        .returns<PersonRecord[]>(),
      supabase
        .from("person_roles")
        .select("id, person_id, role_id")
        .eq("workspace_id", workspaceId)
        .returns<PersonRoleRecord[]>(),
    ]);

  const readError =
    organizationsResult.error ||
    rolesResult.error ||
    peopleResult.error ||
    personRolesResult.error;
  if (readError) {
    return NextResponse.json(
      { error: `Falha ao ler dados atuais do workspace: ${readError.message}` },
      { status: 400 },
    );
  }

  const organizations = organizationsResult.data || [];
  const roles = rolesResult.data || [];
  const people = peopleResult.data || [];
  const personRoles = personRolesResult.data || [];

  const organizationByName = new Map<string, OrganizationRecord>();
  organizations.forEach((organization) => {
    organizationByName.set(normalizeKey(organization.name), organization);
  });

  const roleByOrganizationAndName = new Map<string, RoleRecord>();
  roles.forEach((role) => {
    const roleKey = `${role.organization_id}::${normalizeKey(role.name)}`;
    roleByOrganizationAndName.set(roleKey, role);
  });

  const peopleByEmail = new Map<string, PersonRecord>();
  const peopleByName = new Map<string, PersonRecord>();
  people.forEach((person) => {
    if (person.email) {
      peopleByEmail.set(normalizeEmail(person.email), person);
    }
    peopleByName.set(normalizeKey(person.name), person);
  });

  const linkKeys = new Set<string>();
  personRoles.forEach((link) => {
    linkKeys.add(`${link.person_id}::${link.role_id}`);
  });

  const summary: ImportSummary = {
    processedRows: 0,
    createdOrganizations: 0,
    createdRoles: 0,
    createdPeople: 0,
    createdLinks: 0,
    skippedRows: 0,
    issues: [],
  };

  for (const row of parsedRows) {
    summary.processedRows += 1;

    const hasOrgData =
      Boolean(row.organizationName) ||
      Boolean(row.organizationType) ||
      Boolean(row.parentOrganizationName) ||
      Boolean(row.parentOrganizationType);
    const hasRoleData = Boolean(row.roleName) || Boolean(row.roleResponsibilities);
    const hasPersonData =
      Boolean(row.personName) ||
      Boolean(row.personEmail) ||
      Boolean(row.personPhone) ||
      Boolean(row.personActive);
    const hasLinkDates = Boolean(row.linkStartDate) || Boolean(row.linkEndDate);

    if (!hasOrgData && !hasRoleData && !hasPersonData && !hasLinkDates) {
      summary.skippedRows += 1;
      continue;
    }

    let organizationId = "";

    if (row.organizationName) {
      let parentOrganizationId: string | null = null;
      if (row.parentOrganizationName) {
        const parentKey = normalizeKey(row.parentOrganizationName);
        let parentOrganization = organizationByName.get(parentKey);

        if (!parentOrganization) {
          const { data: createdParent, error: createParentError } = await supabase
            .from("organizations")
            .insert({
              workspace_id: workspaceId,
              name: row.parentOrganizationName,
              type: row.parentOrganizationType || "organizacao",
              parent_id: null,
            })
            .select("id, name, type, parent_id")
            .single<OrganizationRecord>();

          if (createParentError || !createdParent) {
            pushIssue(summary.issues, {
              row: row.rowNumber,
              message: `Falha ao criar organizacao pai "${row.parentOrganizationName}": ${createParentError?.message || "erro desconhecido"}.`,
            });
            summary.skippedRows += 1;
            continue;
          }

          parentOrganization = createdParent;
          organizationByName.set(parentKey, parentOrganization);
          summary.createdOrganizations += 1;
        }

        parentOrganizationId = parentOrganization.id;
      }

      const organizationKey = normalizeKey(row.organizationName);
      let organization = organizationByName.get(organizationKey);

      if (!organization) {
        const { data: createdOrganization, error: createOrganizationError } = await supabase
          .from("organizations")
          .insert({
            workspace_id: workspaceId,
            name: row.organizationName,
            type: row.organizationType || "organizacao",
            parent_id: parentOrganizationId,
          })
          .select("id, name, type, parent_id")
          .single<OrganizationRecord>();

        if (createOrganizationError || !createdOrganization) {
          pushIssue(summary.issues, {
            row: row.rowNumber,
            message: `Falha ao criar organizacao "${row.organizationName}": ${createOrganizationError?.message || "erro desconhecido"}.`,
          });
          summary.skippedRows += 1;
          continue;
        }

        organization = createdOrganization;
        organizationByName.set(organizationKey, organization);
        summary.createdOrganizations += 1;
      }

      organizationId = organization.id;
    }

    let roleId = "";
    if (row.roleName) {
      if (!organizationId) {
        pushIssue(summary.issues, {
          row: row.rowNumber,
          message: "Cargo informado sem organization_name. Linha ignorada para cargo/vinculo.",
        });
      } else {
        const roleKey = `${organizationId}::${normalizeKey(row.roleName)}`;
        let role = roleByOrganizationAndName.get(roleKey);

        if (!role) {
          const { data: createdRole, error: createRoleError } = await supabase
            .from("roles")
            .insert({
              workspace_id: workspaceId,
              organization_id: organizationId,
              name: row.roleName,
              responsibilities: row.roleResponsibilities || null,
            })
            .select("id, name, organization_id")
            .single<RoleRecord>();

          if (createRoleError || !createdRole) {
            pushIssue(summary.issues, {
              row: row.rowNumber,
              message: `Falha ao criar cargo "${row.roleName}": ${createRoleError?.message || "erro desconhecido"}.`,
            });
            summary.skippedRows += 1;
            continue;
          }

          role = createdRole;
          roleByOrganizationAndName.set(roleKey, role);
          summary.createdRoles += 1;
        }

        roleId = role.id;
      }
    }

    if (hasPersonData && !row.personName) {
      pushIssue(summary.issues, {
        row: row.rowNumber,
        message: "Pessoa sem nome. Linha ignorada para pessoa/vinculo.",
      });
      summary.skippedRows += 1;
      continue;
    }

    let personId = "";
    if (row.personName) {
      const normalizedEmail = row.personEmail ? normalizeEmail(row.personEmail) : "";
      let person =
        (normalizedEmail ? peopleByEmail.get(normalizedEmail) : undefined) ||
        peopleByName.get(normalizeKey(row.personName));

      if (!person) {
        const { data: createdPerson, error: createPersonError } = await supabase
          .from("people")
          .insert({
            workspace_id: workspaceId,
            name: row.personName,
            email: row.personEmail || null,
            phone: row.personPhone || null,
            active: parseBoolean(row.personActive, true),
          })
          .select("id, name, email")
          .single<PersonRecord>();

        if (createPersonError || !createdPerson) {
          pushIssue(summary.issues, {
            row: row.rowNumber,
            message: `Falha ao criar pessoa "${row.personName}": ${createPersonError?.message || "erro desconhecido"}.`,
          });
          summary.skippedRows += 1;
          continue;
        }

        person = createdPerson;
        peopleByName.set(normalizeKey(createdPerson.name), createdPerson);
        if (createdPerson.email) {
          peopleByEmail.set(normalizeEmail(createdPerson.email), createdPerson);
        }
        summary.createdPeople += 1;
      }

      personId = person.id;
    }

    if (personId && roleId) {
      const parsedStartDate = parseDate(row.linkStartDate);
      const parsedEndDate = parseDate(row.linkEndDate);

      if (parsedStartDate.error) {
        pushIssue(summary.issues, { row: row.rowNumber, message: parsedStartDate.error });
      }
      if (parsedEndDate.error) {
        pushIssue(summary.issues, { row: row.rowNumber, message: parsedEndDate.error });
      }

      const linkKey = `${personId}::${roleId}`;
      if (!linkKeys.has(linkKey)) {
        const { error: createLinkError } = await supabase.from("person_roles").insert({
          workspace_id: workspaceId,
          person_id: personId,
          role_id: roleId,
          start_date: parsedStartDate.value,
          end_date: parsedEndDate.value,
        });

        if (createLinkError) {
          pushIssue(summary.issues, {
            row: row.rowNumber,
            message: `Falha ao criar vinculo pessoa-cargo: ${createLinkError.message}.`,
          });
          summary.skippedRows += 1;
          continue;
        }

        linkKeys.add(linkKey);
        summary.createdLinks += 1;
      }
    } else if (hasLinkDates && !roleId) {
      pushIssue(summary.issues, {
        row: row.rowNumber,
        message: "Datas de vinculo informadas sem cargo valido.",
      });
    }
  }

  revalidatePath("/organograma");
  revalidatePath("/people");
  revalidatePath("/roles");
  revalidatePath("/organizations");

  return NextResponse.json({ ok: true, summary });
}

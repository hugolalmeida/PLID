import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import {
  canWriteWorkspaceRole,
  getWorkspaceRoleForUser,
} from "@/lib/workspaces/permissions";

type OrganizationRecord = {
  id: string;
  parent_id: string | null;
};

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

  const workspaceRole = await getWorkspaceRoleForUser(supabase, user.id, workspaceId);
  if (!canWriteWorkspaceRole(workspaceRole)) {
    return NextResponse.json(
      { error: "Voce nao tem permissao para alterar este organograma." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const organizationId = readValue(formData, "organization_id");
  const name = readValue(formData, "name");
  const type = readValue(formData, "type");
  const parentId = readValue(formData, "parent_id");

  if (!organizationId || !name || !type) {
    return NextResponse.json(
      { error: "Organizacao, nome e tipo sao obrigatorios." },
      { status: 400 },
    );
  }

  if (parentId === organizationId) {
    return NextResponse.json(
      { error: "A organizacao nao pode ser pai dela mesma." },
      { status: 400 },
    );
  }

  const [organizationResult, organizationsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, parent_id")
      .eq("id", organizationId)
      .eq("workspace_id", workspaceId)
      .maybeSingle<OrganizationRecord>(),
    supabase
      .from("organizations")
      .select("id, parent_id")
      .eq("workspace_id", workspaceId)
      .returns<OrganizationRecord[]>(),
  ]);

  const readError = organizationResult.error || organizationsResult.error;
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }

  if (!organizationResult.data) {
    return NextResponse.json(
      { error: "Organizacao nao pertence ao workspace ativo." },
      { status: 400 },
    );
  }

  if (parentId) {
    const organizations = organizationsResult.data || [];
    const parentExists = organizations.some((organization) => organization.id === parentId);
    if (!parentExists) {
      return NextResponse.json(
        { error: "Organizacao pai nao pertence ao workspace ativo." },
        { status: 400 },
      );
    }

    const childrenByParent = new Map<string, OrganizationRecord[]>();
    for (const organization of organizations) {
      if (!organization.parent_id) continue;
      const current = childrenByParent.get(organization.parent_id) || [];
      current.push(organization);
      childrenByParent.set(organization.parent_id, current);
    }

    const stack = [organizationId];
    const descendants = new Set<string>();
    while (stack.length) {
      const currentId = stack.pop();
      if (!currentId || descendants.has(currentId)) continue;
      descendants.add(currentId);
      const children = childrenByParent.get(currentId) || [];
      children.forEach((child) => stack.push(child.id));
    }

    if (descendants.has(parentId)) {
      return NextResponse.json(
        { error: "A organizacao pai nao pode ser uma subordinada dela mesma." },
        { status: 400 },
      );
    }
  }

  const updateResult = await supabase
    .from("organizations")
    .update({
      name,
      type,
      parent_id: parentId || null,
    })
    .eq("id", organizationId)
    .eq("workspace_id", workspaceId);

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 400 });
  }

  revalidatePath("/organograma");
  revalidatePath("/organizations");
  revalidatePath("/roles");

  return NextResponse.json({ ok: true });
}

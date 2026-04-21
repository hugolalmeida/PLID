"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfileAction(formData: FormData) {
  const fullName = readValue(formData, "full_name");
  if (!fullName) {
    redirect("/profile?create=error&message=Informe%20seu%20nome%20completo.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) {
    redirect(`/profile?create=error&message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/");
  redirect("/profile?create=success&message=Perfil%20atualizado%20com%20sucesso.");
}

export async function deleteOwnAccountAction(formData: FormData) {
  const confirmText = readValue(formData, "confirm_text");
  if (confirmText !== "EXCLUIR MINHA CONTA") {
    redirect(
      "/profile?create=error&message=Digite%20EXCLUIR%20MINHA%20CONTA%20para%20confirmar.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ownerMembershipsResult = await supabase
    .from("workspace_members")
    .select("workspace_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "owner");

  if (ownerMembershipsResult.error) {
    redirect(
      `/profile?create=error&message=${encodeURIComponent(ownerMembershipsResult.error.message)}`,
    );
  }

  if ((ownerMembershipsResult.count || 0) > 0) {
    redirect(
      "/profile?create=error&message=Transfira%20ownership%20dos%20workspaces%20antes%20de%20excluir%20a%20conta.",
    );
  }

  const admin = createSupabaseAdminClient();
  const deleteAuthUserResult = await admin.auth.admin.deleteUser(user.id);

  if (deleteAuthUserResult.error) {
    redirect(
      `/profile?create=error&message=${encodeURIComponent(deleteAuthUserResult.error.message)}`,
    );
  }

  await supabase.auth.signOut();

  revalidatePath("/");
  redirect("/login?account_deleted=1");
}

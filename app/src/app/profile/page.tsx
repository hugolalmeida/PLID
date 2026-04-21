import { redirect } from "next/navigation";
import { CreateFeedbackBanner } from "@/components/ui/create-feedback-banner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readCreateFeedback, type PageSearchParams } from "@/lib/ui/action-feedback";
import { deleteOwnAccountAction, updateProfileAction } from "./actions";
import { AccountSecurityCard } from "./account-security-card";

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  role: "presidencia" | "secretaria" | "lider" | "visualizador";
};

function roleLabel(role: ProfileRow["role"] | undefined) {
  if (role === "presidencia") return "Presidencia";
  if (role === "secretaria") return "Secretaria";
  if (role === "lider") return "Lider";
  if (role === "visualizador") return "Visualizador";
  return "Nao definido";
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const createFeedback = readCreateFeedback(resolvedSearchParams);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new Error(error.message);
  }

  const fullName = profile?.full_name?.trim() || "";
  const email = profile?.email || user.email || "";
  const role = profile?.role;

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
          Conta
        </p>
        <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Meu perfil</h1>
        <p className="muted-text mt-2 text-sm">
          Atualize seus dados de exibicao. O e-mail e o papel sao definidos pelo sistema.
        </p>

        <CreateFeedbackBanner status={createFeedback.status} message={createFeedback.message} />

        <form action={updateProfileAction} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            Nome completo
            <input
              name="full_name"
              required
              defaultValue={fullName}
              placeholder="Seu nome"
              className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </label>

          <label className="block text-sm font-medium">
            E-mail
            <input
              value={email}
              readOnly
              className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[#f7f7f7] p-2.5 text-sm text-[var(--muted)]"
            />
          </label>

          <label className="block text-sm font-medium">
            Papel
            <input
              value={roleLabel(role)}
              readOnly
              className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[#f7f7f7] p-2.5 text-sm text-[var(--muted)]"
            />
          </label>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Salvar perfil
            </button>
          </div>
        </form>

        <AccountSecurityCard email={email} />

        <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Zona de perigo</p>
          <p className="mt-1 text-sm text-red-700">
            Excluir conta remove seu acesso permanentemente. Essa acao nao pode ser desfeita.
          </p>
          <form action={deleteOwnAccountAction} className="mt-3">
            <p className="text-xs text-red-700">
              Digite <strong>EXCLUIR MINHA CONTA</strong> para confirmar:
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                name="confirm_text"
                required
                className="min-w-[260px] rounded-md border border-red-200 bg-white px-2 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700"
              >
                Excluir conta
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}

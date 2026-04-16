import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createPersonAction,
  deletePersonAction,
  updatePersonAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";

type Person = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
};

type Profile = {
  role: UserRole;
};

export default async function PeoplePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const { data: people, error } = await supabase
    .from("people")
    .select("id, name, email, phone, active")
    .order("name", { ascending: true })
    .returns<Person[]>();

  if (error) {
    throw new Error(error.message);
  }

  const canManage = profile?.role !== "visualizador";

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 3
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Pessoas</h1>
            <p className="muted-text mt-2 text-sm">
              Cadastro de lideres e membros com contato e status de atividade.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar ao dashboard
          </Link>
        </div>

        {canManage ? (
          <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-base font-semibold">Nova pessoa</h2>
            <form action={createPersonAction} className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                name="name"
                placeholder="Nome completo"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <input
                name="email"
                placeholder="E-mail"
                type="email"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <input
                name="phone"
                placeholder="Telefone"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <select
                name="active"
                defaultValue="true"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
              <button
                type="submit"
                className="md:col-span-4 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
              >
                Criar pessoa
              </button>
            </form>
          </section>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nome</th>
                <th className="px-4 py-3 text-left font-semibold">E-mail</th>
                <th className="px-4 py-3 text-left font-semibold">Telefone</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {people?.length ? (
                people.map((person) => (
                  <tr key={person.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3">
                      {canManage ? (
                        <form action={updatePersonAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={person.id} />
                          <input
                            name="name"
                            defaultValue={person.name}
                            required
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <input
                            name="email"
                            type="email"
                            defaultValue={person.email || ""}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <input
                            name="phone"
                            defaultValue={person.phone || ""}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <select
                            name="active"
                            defaultValue={person.active ? "true" : "false"}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          >
                            <option value="true">Ativo</option>
                            <option value="false">Inativo</option>
                          </select>
                          <button
                            type="submit"
                            className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium"
                          >
                            Salvar
                          </button>
                        </form>
                      ) : (
                        person.name
                      )}
                    </td>
                    <td className="px-4 py-3">{person.email || "-"}</td>
                    <td className="px-4 py-3">{person.phone || "-"}</td>
                    <td className="px-4 py-3">{person.active ? "Ativo" : "Inativo"}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <form action={deletePersonAction}>
                          <input type="hidden" name="id" value={person.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700"
                          >
                            Remover
                          </button>
                        </form>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 muted-text" colSpan={5}>
                    Nenhuma pessoa cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}

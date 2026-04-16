import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createGoalAction,
  deleteGoalAction,
  updateGoalAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";

type Profile = {
  role: UserRole;
};

type Organization = {
  id: string;
  name: string;
};

type Person = {
  id: string;
  name: string;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  organization_id: string;
  owner_person_id: string;
  period_start: string;
  period_end: string;
  target_value: number;
  current_value: number;
  status: "draft" | "active" | "at_risk" | "achieved" | "cancelled";
};

const statusOptions: Array<Goal["status"]> = [
  "draft",
  "active",
  "at_risk",
  "achieved",
  "cancelled",
];

function statusLabel(status: Goal["status"]) {
  if (status === "draft") return "Rascunho";
  if (status === "active") return "Ativa";
  if (status === "at_risk") return "Em risco";
  if (status === "achieved") return "Concluida";
  return "Cancelada";
}

function progressPercent(currentValue: number, targetValue: number) {
  if (targetValue <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentValue / targetValue) * 100)));
}

export default async function GoalsPage() {
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

  const [goalsResult, organizationsResult, peopleResult] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, title, description, organization_id, owner_person_id, period_start, period_end, target_value, current_value, status",
      )
      .order("created_at", { ascending: false })
      .returns<Goal[]>(),
    supabase
      .from("organizations")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<Organization[]>(),
    supabase
      .from("people")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<Person[]>(),
  ]);

  const firstError =
    goalsResult.error || organizationsResult.error || peopleResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const goals = goalsResult.data || [];
  const organizations = organizationsResult.data || [];
  const people = peopleResult.data || [];
  const canManage = profile?.role !== "visualizador";

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 8
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Metas</h1>
            <p className="muted-text mt-2 text-sm">
              Defina metas por periodo, acompanhe progresso e registre atualizacoes.
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
            <h2 className="text-base font-semibold">Nova meta</h2>
            <form action={createGoalAction} className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                name="title"
                placeholder="Titulo da meta"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <input
                name="description"
                placeholder="Descricao"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <select
                name="organization_id"
                required
                defaultValue=""
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              >
                <option value="" disabled>
                  Organizacao
                </option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <select
                name="owner_person_id"
                required
                defaultValue=""
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              >
                <option value="" disabled>
                  Responsavel
                </option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="period_start"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <input
                type="date"
                name="period_end"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                name="target_value"
                placeholder="Meta alvo"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                name="current_value"
                defaultValue="0"
                placeholder="Valor atual"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <select
                name="status"
                defaultValue="draft"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
              >
                Criar meta
              </button>
            </form>
          </section>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Meta</th>
                <th className="px-4 py-3 text-left font-semibold">Responsavel</th>
                <th className="px-4 py-3 text-left font-semibold">Periodo</th>
                <th className="px-4 py-3 text-left font-semibold">Progresso</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {goals.length ? (
                goals.map((goal) => {
                  const ownerName =
                    people.find((person) => person.id === goal.owner_person_id)?.name || "-";
                  const progress = progressPercent(goal.current_value, goal.target_value);

                  return (
                    <tr key={goal.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3">
                        {canManage ? (
                          <form action={updateGoalAction} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="id" value={goal.id} />
                            <input
                              name="title"
                              defaultValue={goal.title}
                              required
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <input
                              name="description"
                              defaultValue={goal.description || ""}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <select
                              name="organization_id"
                              defaultValue={goal.organization_id}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            >
                              {organizations.map((organization) => (
                                <option key={organization.id} value={organization.id}>
                                  {organization.name}
                                </option>
                              ))}
                            </select>
                            <select
                              name="owner_person_id"
                              defaultValue={goal.owner_person_id}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            >
                              {people.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              name="period_start"
                              defaultValue={goal.period_start}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <input
                              type="date"
                              name="period_end"
                              defaultValue={goal.period_end}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              name="target_value"
                              defaultValue={goal.target_value}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              name="current_value"
                              defaultValue={goal.current_value}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <select
                              name="status"
                              defaultValue={goal.status}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium"
                            >
                              Salvar
                            </button>
                          </form>
                        ) : (
                          <div>
                            <p className="font-medium">{goal.title}</p>
                            <p className="muted-text text-xs">{goal.description || "-"}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{ownerName}</td>
                      <td className="px-4 py-3">
                        {goal.period_start} ate {goal.period_end}
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-36 rounded-full bg-[#ece7dd]">
                          <div
                            className="h-2 rounded-full bg-[var(--accent)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {goal.current_value} / {goal.target_value} ({progress}%)
                        </p>
                      </td>
                      <td className="px-4 py-3">{statusLabel(goal.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/goals/${goal.id}`}
                            className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium"
                          >
                            Detalhes
                          </Link>
                          {canManage ? (
                            <form action={deleteGoalAction}>
                              <input type="hidden" name="id" value={goal.id} />
                              <button
                                type="submit"
                                className="rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700"
                              >
                                Remover
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 muted-text" colSpan={6}>
                    Nenhuma meta cadastrada ainda.
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


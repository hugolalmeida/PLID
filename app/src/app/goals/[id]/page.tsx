import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createGoalUpdateAction } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import { canWriteWorkspaceRole, getWorkspaceRoleForUser } from "@/lib/workspaces/permissions";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  status: "draft" | "active" | "at_risk" | "achieved" | "cancelled";
  period_start: string;
  period_end: string;
};

type GoalUpdate = {
  id: string;
  update_note: string;
  current_value: number;
  created_by: string;
  created_at: string;
};

type Person = {
  id: string;
  name: string;
};

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

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Selecione%20ou%20crie%20um%20workspace.");
  }

  const [goalResult, updatesResult, peopleResult] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, title, description, target_value, current_value, status, period_start, period_end",
      )
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle<Goal>(),
    supabase
      .from("goal_updates")
      .select("id, update_note, current_value, created_by, created_at")
      .eq("goal_id", id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .returns<GoalUpdate[]>(),
    supabase
      .from("people")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .returns<Person[]>(),
  ]);

  if (goalResult.error || updatesResult.error || peopleResult.error) {
    throw new Error(
      goalResult.error?.message ||
        updatesResult.error?.message ||
        peopleResult.error?.message,
    );
  }

  const goal = goalResult.data;

  if (!goal) {
    notFound();
  }

  const updates = updatesResult.data || [];
  const people = peopleResult.data || [];
  const workspaceRole = await getWorkspaceRoleForUser(supabase, user.id, workspaceId);
  const canManage = canWriteWorkspaceRole(workspaceRole);
  const progress = progressPercent(goal.current_value, goal.target_value);

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Meta
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{goal.title}</h1>
            <p className="muted-text mt-2 text-sm">{goal.description || "-"}</p>
          </div>
          <Link
            href="/goals"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar para metas
          </Link>
        </div>

        <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Periodo
              </p>
              <p className="mt-1 text-sm">
                {goal.period_start} ate {goal.period_end}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Status
              </p>
              <p className="mt-1 text-sm">{statusLabel(goal.status)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Progresso
              </p>
              <p className="mt-1 text-sm">
                {goal.current_value} / {goal.target_value} ({progress}%)
              </p>
            </div>
          </div>
          <div className="mt-3 w-full rounded-full bg-[#ece7dd]">
            <div
              className="h-2 rounded-full bg-[var(--accent)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        {canManage ? (
          <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-base font-semibold">Nova atualizacao</h2>
            <form action={createGoalUpdateAction} className="mt-4 grid gap-3 md:grid-cols-3">
              <input type="hidden" name="goal_id" value={goal.id} />
              <input
                name="update_note"
                placeholder="Resumo da atualizacao"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                name="current_value"
                defaultValue={goal.current_value}
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
              >
                Registrar atualizacao
              </button>
            </form>
          </section>
        ) : null}

        <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-base font-semibold">Historico</h2>
          {updates.length ? (
            <ul className="mt-3 space-y-3">
              {updates.map((update) => (
                <li key={update.id} className="rounded-lg border border-[var(--line)] p-3">
                  <p className="text-sm font-medium">{update.update_note}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Valor atual: {update.current_value}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Autor:{" "}
                    {people.find((person) => person.id === update.created_by)?.name ||
                      update.created_by}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Data: {new Date(update.created_at).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text mt-2 text-sm">Nenhuma atualizacao registrada.</p>
          )}
        </section>
      </section>
    </main>
  );
}

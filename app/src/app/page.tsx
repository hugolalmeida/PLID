import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-10">
        <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
          Projeto MVP
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
          Plataforma de Lideranca da Igreja
        </h1>
        <p className="muted-text mt-4 max-w-3xl">
          Estrutura inicial pronta com Next.js + Supabase para acelerar os
          modulos de autenticacao, organograma, atividades e reunioes.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="surface-card p-5">
          <h2 className="text-lg font-semibold">Fase atual</h2>
          <p className="muted-text mt-2">
            Bootstrap do projeto finalizado. Proximo alvo: autenticar usuarios
            e cadastrar perfis (presidencia, secretaria, lider, visualizador).
          </p>
        </article>
        <article className="surface-card p-5">
          <h2 className="text-lg font-semibold">Checklist de hoje</h2>
          <ul className="muted-text mt-2 space-y-1 text-sm">
            <li>1. Base Next.js criada</li>
            <li>2. Supabase client configurado</li>
            <li>3. Ambiente `.env` preparado</li>
            <li>4. Roadmap do MVP documentado</li>
          </ul>
        </article>
      </section>

      <section className="mt-6 surface-card p-5">
        <h2 className="text-lg font-semibold">Acesso</h2>
        <p className="muted-text mt-2 text-sm">
          Com o Supabase configurado no `.env.local`, use o login para testar o
          dashboard protegido.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Ir para login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold"
          >
            Abrir dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6 md:p-10">
      <section className="surface-card grid w-full max-w-5xl gap-6 p-6 md:grid-cols-[1.1fr_1fr] md:items-center md:p-8">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="flex items-center gap-4">
            <Image
              src="/plid_mark.png"
              alt="PLID"
              width={84}
              height={84}
              className="h-16 w-16 object-contain md:h-20 md:w-20"
              priority
            />
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
                PLID
              </p>
              <h1 className="text-2xl font-semibold md:text-3xl">Painel de Lideranca</h1>
            </div>
          </div>
          <p className="muted-text mt-4 max-w-md text-sm md:text-base">
            Acesse sua conta para gerenciar organizacoes, equipes, metas, reunioes e atividades.
          </p>
        </div>
        <div className="flex justify-center md:justify-end">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "signin" | "signup";

function mapAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha invalidos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (normalized.includes("user already registered")) {
    return "Este e-mail ja esta cadastrado.";
  }
  if (normalized.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (normalized.includes("unable to validate email address")) {
    return "Informe um e-mail valido.";
  }

  return message;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(mapAuthError(signInError.message));
        setLoading(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(mapAuthError(signUpError.message));
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setSuccess("Conta criada. Verifique seu e-mail para confirmar o cadastro.");
    setMode("signin");
    setPassword("");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">
        {mode === "signin" ? "Entrar" : "Criar conta"}
      </h1>
      <p className="muted-text mt-2 text-sm">
        {mode === "signin"
          ? "Use seu e-mail e senha cadastrados no Supabase."
          : "Crie sua conta para acessar os modulos do sistema."}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-[var(--line)] bg-white p-1">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
            setSuccess(null);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "signin"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--foreground)]"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setSuccess(null);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "signup"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--foreground)]"
          }`}
        >
          Criar conta
        </button>
      </div>

      {mode === "signup" ? (
        <>
          <label className="mt-6 block text-sm font-medium">Nome completo</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </>
      ) : null}

      <label className="mt-6 block text-sm font-medium">E-mail</label>
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />

      <label className="mt-4 block text-sm font-medium">Senha</label>
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading
          ? mode === "signin"
            ? "Entrando..."
            : "Criando..."
          : mode === "signin"
            ? "Entrar"
            : "Criar conta"}
      </button>
    </form>
  );
}

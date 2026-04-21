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
  const accountDeleted = searchParams.get("account_deleted") === "1";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

      {accountDeleted ? (
        <p className="mt-3 text-sm text-emerald-700">
          Conta excluida com sucesso.
        </p>
      ) : null}

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
      <div className="relative mt-2">
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-[var(--line)] bg-white p-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] hover:bg-[#f2ece3]"
          title={showPassword ? "Ocultar senha" : "Mostrar senha"}
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPassword ? (
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <path d="M3.28 2.22a.75.75 0 00-1.06 1.06l2.116 2.116A10.772 10.772 0 001 10c1.58 2.86 4.607 5 9 5 1.86 0 3.48-.384 4.885-1.038l1.835 1.836a.75.75 0 101.06-1.06L3.28 2.22zM10 13.5c-2.59 0-4.547-1.355-5.88-3.5a9.58 9.58 0 012.28-2.695l1.56 1.56A2.75 2.75 0 0011.136 12l1.7 1.699A7.42 7.42 0 0110 13.5z" />
              <path d="M19 10c-.943 1.706-2.378 3.141-4.283 4.026l-1.25-1.25c1.35-.676 2.398-1.695 3.186-2.776C15.32 7.855 13.363 6.5 10.773 6.5c-.643 0-1.25.083-1.821.238L7.69 5.476A9.34 9.34 0 0110.773 5c4.393 0 7.42 2.14 9 5z" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <path d="M10 5c-4.393 0-7.42 2.14-9 5 1.58 2.86 4.607 5 9 5s7.42-2.14 9-5c-1.58-2.86-4.607-5-9-5zm0 8.5A3.5 3.5 0 1110 6a3.5 3.5 0 010 7.5z" />
              <path d="M10 8a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          )}
        </button>
      </div>
      {mode === "signin" ? (
        <div className="mt-2 text-right">
          <a
            href="/forgot-password"
            className="text-xs font-medium text-[var(--accent)] underline underline-offset-2"
          >
            Esqueci minha senha
          </a>
        </div>
      ) : null}

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

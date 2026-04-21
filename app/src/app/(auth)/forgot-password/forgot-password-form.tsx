"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function mapResetError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("unable to validate email address")) {
    return "Informe um e-mail valido.";
  }

  return message;
}

function getRedirectTo() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`;
  }

  return undefined;
}

export function ForgotPasswordForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRedirectTo(),
    });

    if (resetError) {
      setError(mapResetError(resetError.message));
      setLoading(false);
      return;
    }

    setSuccess(
      "Enviamos um link de recuperacao. Abra seu e-mail e clique no link para redefinir a senha.",
    );
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Recuperar senha</h1>
      <p className="muted-text mt-2 text-sm">
        Informe seu e-mail para receber o link de redefinicao.
      </p>

      <label className="mt-6 block text-sm font-medium">E-mail</label>
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Enviando..." : "Enviar link"}
      </button>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--accent)] underline underline-offset-2"
        >
          Voltar para entrar
        </Link>
      </div>
    </form>
  );
}

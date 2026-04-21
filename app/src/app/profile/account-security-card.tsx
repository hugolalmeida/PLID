"use client";

import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function mapPasswordError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Senha atual invalida.";
  }
  if (normalized.includes("password should be at least")) {
    return "A nova senha precisa ter pelo menos 6 caracteres.";
  }
  if (normalized.includes("same password")) {
    return "A nova senha precisa ser diferente da atual.";
  }
  if (normalized.includes("auth session missing")) {
    return "Sua sessao expirou. Entre novamente.";
  }

  return message;
}

function EyeIcon({ closed }: { closed: boolean }) {
  if (closed) {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
        <path d="M3.28 2.22a.75.75 0 00-1.06 1.06l2.116 2.116A10.772 10.772 0 001 10c1.58 2.86 4.607 5 9 5 1.86 0 3.48-.384 4.885-1.038l1.835 1.836a.75.75 0 101.06-1.06L3.28 2.22zM10 13.5c-2.59 0-4.547-1.355-5.88-3.5a9.58 9.58 0 012.28-2.695l1.56 1.56A2.75 2.75 0 0011.136 12l1.7 1.699A7.42 7.42 0 0110 13.5z" />
        <path d="M19 10c-.943 1.706-2.378 3.141-4.283 4.026l-1.25-1.25c1.35-.676 2.398-1.695 3.186-2.776C15.32 7.855 13.363 6.5 10.773 6.5c-.643 0-1.25.083-1.821.238L7.69 5.476A9.34 9.34 0 0110.773 5c4.393 0 7.42 2.14 9 5z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <path d="M10 5c-4.393 0-7.42 2.14-9 5 1.58 2.86 4.607 5 9 5s7.42-2.14 9-5c-1.58-2.86-4.607-5-9-5zm0 8.5A3.5 3.5 0 1110 6a3.5 3.5 0 010 7.5z" />
      <path d="M10 8a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

export function AccountSecurityCard({ email }: { email: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmacao da nova senha nao confere.");
      setLoading(false);
      return;
    }

    const signInResult = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInResult.error) {
      setPasswordError(mapPasswordError(signInResult.error.message));
      setLoading(false);
      return;
    }

    const updateResult = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateResult.error) {
      setPasswordError(mapPasswordError(updateResult.error.message));
      setLoading(false);
      return;
    }

    setPasswordSuccess("Senha alterada com sucesso.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  }

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-[var(--line)] bg-white p-4">
      <div>
        <h2 className="text-base font-semibold">Seguranca da conta</h2>
        <p className="muted-text mt-1 text-sm">
          Troque sua senha e, se necessario, exclua sua conta.
        </p>
      </div>

      <form onSubmit={handleChangePassword} className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium text-[var(--muted)]">
          Senha atual
          <div className="relative mt-1">
            <input
              type={showCurrentPassword ? "text" : "password"}
              required
              minLength={6}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 pr-9 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((current) => !current)}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] hover:bg-[#f2ece3]"
              title={showCurrentPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showCurrentPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              <EyeIcon closed={showCurrentPassword} />
            </button>
          </div>
        </label>

        <label className="text-xs font-medium text-[var(--muted)]">
          Nova senha
          <div className="relative mt-1">
            <input
              type={showNewPassword ? "text" : "password"}
              required
              minLength={6}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 pr-9 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((current) => !current)}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] hover:bg-[#f2ece3]"
              title={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              <EyeIcon closed={showNewPassword} />
            </button>
          </div>
        </label>

        <label className="text-xs font-medium text-[var(--muted)]">
          Confirmar nova senha
          <div className="relative mt-1">
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 pr-9 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] hover:bg-[#f2ece3]"
              title={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              <EyeIcon closed={showConfirmPassword} />
            </button>
          </div>
        </label>

        <div className="md:col-span-3">
          {passwordError ? <p className="text-sm text-red-700">{passwordError}</p> : null}
          {passwordSuccess ? <p className="text-sm text-emerald-700">{passwordSuccess}</p> : null}
        </div>

        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Salvando..." : "Trocar senha"}
          </button>
        </div>
      </form>
    </section>
  );
}

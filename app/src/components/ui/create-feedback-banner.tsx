export function CreateFeedbackBanner({
  status,
  message,
}: {
  status?: "success" | "error";
  message?: string;
}) {
  if (!status) return null;

  const isSuccess = status === "success";
  const title = isSuccess ? "Salvo com sucesso" : "Falha ao salvar";
  const fallbackMessage = isSuccess
    ? "Item criado e registrado no sistema."
    : "Nao foi possivel concluir a criacao.";

  return (
    <div
      className={`mt-4 rounded-xl border p-3 text-sm ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message || fallbackMessage}</p>
    </div>
  );
}

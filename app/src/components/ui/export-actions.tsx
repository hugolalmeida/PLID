"use client";

type ExportActionsProps = {
  csvHref: string;
};

export function ExportActions({ csvHref }: ExportActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={csvHref}
        className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
      >
        Exportar CSV
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
      >
        Exportar PDF
      </button>
    </div>
  );
}


"use client";

import { useMemo, useState } from "react";

type PersonRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
};

type BishopricNames = {
  bishop: string;
  firstCounselor: string;
  secondCounselor: string;
};

type ConviteDiscursoClientProps = {
  workspaceName: string;
  people: PersonRow[];
  bishopric: BishopricNames;
};

type SpeakerGender = "brother" | "sister";

const POSITION_OPTIONS = [
  { value: "Primeiro orador", label: "Primeiro Orador" },
  { value: "Segundo orador", label: "Segundo Orador" },
  { value: "Último orador", label: "Último Orador" },
];
const MATERIAL_BASE_MAX_LENGTH = 180;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value: string) {
  if (!value) return "";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

function normalizeWardName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Ala";
  return trimmed.toLowerCase().startsWith("ala ") ? trimmed : `Ala ${trimmed}`;
}

export function ConviteDiscursoClient({
  workspaceName,
  people,
  bishopric,
}: ConviteDiscursoClientProps) {
  const [wardName, setWardName] = useState(normalizeWardName(workspaceName));
  const [speakerName, setSpeakerName] = useState(people[0]?.name || "");
  const [gender, setGender] = useState<SpeakerGender>("brother");
  const [theme, setTheme] = useState("Magnificar meu chamado");
  const [date, setDate] = useState(todayIso());
  const [duration, setDuration] = useState("15");
  const [position, setPosition] = useState("Primeiro orador");
  const [meetingTime, setMeetingTime] = useState("09:00");
  const [arrivalTime, setArrivalTime] = useState("08:45");
  const [materialBase, setMaterialBase] = useState(
    "Líderes da Igreja; Vem, e Segue-Me; Doutrina e Convênios.",
  );

  const speakerTitle = gender === "sister" ? "Irmã" : "Irmão";
  const speakerReference = gender === "sister" ? "irmã" : "irmão";
  const invitationArticle = gender === "sister" ? "à" : "ao";
  const formattedDate = formatDisplayDate(date);
  const bishopricLines = [
    bishopric.bishop,
    bishopric.firstCounselor,
    bishopric.secondCounselor,
  ].filter(Boolean);

  const peopleOptions = useMemo(
    () => people.filter((person) => person.active).map((person) => person.name),
    [people],
  );

  function printInvite() {
    window.print();
  }

  function focusInvitePreview() {
    document.getElementById("convite-preview")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="space-y-6">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            min-height: 0 !important;
            overflow: hidden !important;
            background: #fffefa !important;
          }

          body * {
            visibility: hidden !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-area,
          .print-area * {
            visibility: visible !important;
          }

          .print-area {
            position: fixed !important;
            inset: 0 auto auto 0 !important;
            width: 210mm !important;
            height: 286mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 5mm 11mm !important;
            background: #fffefa !important;
            box-shadow: none !important;
            border: 0 !important;
            outline: 0 !important;
            overflow: hidden !important;
          }

          .print-area article {
            height: 276mm !important;
            padding: 8mm 10mm !important;
          }

          .print-area header {
            padding-bottom: 3mm !important;
          }

          .print-area h2 {
            font-size: 11pt !important;
            line-height: 1.35 !important;
          }

          .print-area h3 {
            margin-top: 5mm !important;
            font-size: 24pt !important;
            line-height: 1.05 !important;
          }

          .print-area p {
            line-height: 1.45 !important;
          }

          .print-area .print-tight-top {
            margin-top: 4mm !important;
          }

          .print-area .print-hide {
            display: none !important;
          }

          .print-area .print-date-box {
            margin-top: 5mm !important;
            padding: 5mm !important;
          }

          .print-area .print-date-box p {
            margin-top: 1.5mm !important;
          }

          .print-area .print-cta {
            margin-top: 5mm !important;
            padding: 3mm 5mm !important;
            font-size: 9pt !important;
            line-height: 1.35 !important;
          }

          .print-area footer {
            margin-top: 7mm !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <section className="surface-card no-print p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Ferramenta
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              Gerador de Convite para Discurso
            </h1>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-xs font-medium text-[var(--muted)]">
            Ala
            <input
              value={wardName}
              onChange={(event) => setWardName(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Nome
            <input
              list="convite-pessoas"
              value={speakerName}
              onChange={(event) => setSpeakerName(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
            <datalist id="convite-pessoas">
              {peopleOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Sexo
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value as SpeakerGender)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            >
              <option value="brother">Irmão</option>
              <option value="sister">Irmã</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Tema
            <input
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Data
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Tempo do Discurso (min)
            <input
              type="number"
              min="1"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Posição no Programa
            <select
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            >
              {POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Hora da Reunião
            <input
              type="time"
              value={meetingTime}
              onChange={(event) => setMeetingTime(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Hora de Chegada
            <input
              type="time"
              value={arrivalTime}
              onChange={(event) => setArrivalTime(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted)] md:col-span-3">
            Material base
            <textarea
              value={materialBase}
              maxLength={MATERIAL_BASE_MAX_LENGTH}
              rows={2}
              onChange={(event) => setMaterialBase(event.target.value)}
              className="mt-1 w-full resize-none rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
              placeholder="Ex.: Vem, e Segue-Me; discursos da Conferência Geral; Doutrina e Convênios."
            />
            <span className="mt-1 block text-right text-[11px] text-[var(--muted)]">
              {materialBase.length}/{MATERIAL_BASE_MAX_LENGTH}
            </span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={focusInvitePreview}
            className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent)]"
          >
            Gerar Convite
          </button>
          <button
            type="button"
            onClick={printInvite}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Imprimir / Salvar PDF
          </button>
        </div>
      </section>

      <section
        id="convite-preview"
        className="print-area mx-auto w-full max-w-[760px] bg-[#fffefa] p-5 text-[#0f3f23] shadow-sm ring-1 ring-[var(--line)]"
      >
        <article className="relative border border-[#1f6f35] px-6 py-10 sm:px-10">
          <div className="pointer-events-none absolute inset-2 border border-[#1f6f35]" />
          <div className="relative mx-auto max-w-[560px] text-center">
            <header className="mx-auto max-w-[410px] border-b border-[#c7b15a] pb-4">
              <h2 className="font-serif text-[15px] font-semibold uppercase tracking-[0.22em] text-[#0f4b2a]">
                A Igreja de Jesus Cristo dos Santos dos Últimos Dias
              </h2>
            </header>

            <p className="print-tight-top mt-12 text-[11px] uppercase tracking-[0.28em] text-[#557260]">
              {speakerTitle}
            </p>
            <h3 className="mt-6 break-words font-serif text-4xl italic text-[#17361f]">
              {speakerName || "Nome do orador"}
            </h3>
            <div className="mx-auto mt-4 h-px w-32 bg-[#c7b15a]" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.26em] text-[#8a986b]">
              {wardName || "Ala"}
            </p>

            <p className="print-tight-top mt-8 text-justify text-sm leading-7 text-[#17361f]">
              O bispado da <strong>{wardName || "Ala"}</strong>, pelo presente,
              convida {invitationArticle} <strong>{speakerReference}</strong> para
              compartilhar um discurso de <strong>{duration || "15"} minutos</strong> como{" "}
              <strong>{position.toLowerCase()}</strong>, na{" "}
              <strong>Reunião Sacramental</strong>, que realizar-se-á no dia:
            </p>

            <div className="print-date-box mx-auto mt-6 max-w-[390px] border border-[#1f6f35] px-6 py-6">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8a986b]">
                Data do Evento
              </p>
              <p className="mt-2 font-serif text-xl font-semibold uppercase tracking-[0.06em]">
                {formattedDate || "Data"}
              </p>
              <div className="print-hide mx-auto my-5 h-px w-24 bg-[#c7b15a]" />
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8a986b]">
                Tema do Discurso
              </p>
              <p className="mt-3 break-words font-serif text-3xl italic text-[#17361f]">
                {theme || "Tema do discurso"}
              </p>
            </div>

            <p className="print-tight-top mt-6 text-sm leading-7 text-[#17361f]">
              Às <strong>{meetingTime}</strong>, na <strong>{wardName || "Ala"}</strong>,
              e será presidida por <strong>Bispo {bishopric.bishop || "..."}</strong>.
            </p>
            <p className="mt-2 text-sm leading-7 text-[#17361f]">
              Solicitamos sua presença até às <strong>{arrivalTime}</strong>.
            </p>

            <div className="print-tight-top mx-auto mt-8 h-px w-[85%] bg-[#c7b15a]" />
            <section className="print-tight-top mt-5 text-xs leading-6 text-[#47614f]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8a986b]">
                Instruções
              </p>
              <p className="mt-3">
                Material base: <em>{materialBase || "Materiais oficiais da Igreja."}</em>
              </p>
            </section>

            <div className="print-cta mx-auto mt-7 max-w-[430px] bg-[#1f6f35] px-5 py-4 text-sm font-semibold leading-6 text-white">
              Ao se preparar para o seu discurso, ore ao Senhor para ajudá-lo a convidar um amigo ou familiar.
            </div>

            <p className="print-tight-top mt-7 text-xs leading-6 text-[#47614f]">
              Os convidados e familiares do programa de reunião estão sendo convidados a se sentar na capela desde o início da reunião.
            </p>

            <footer className="mt-10">
              <p className="font-serif text-2xl italic text-[#17361f]">Sinceramente,</p>
              <div className="mt-7 text-xs font-semibold uppercase leading-6 tracking-[0.08em] text-[#17361f]">
                {bishopricLines.length ? (
                  bishopricLines.map((name) => <p key={name}>{name}</p>)
                ) : (
                  <p>Bispado</p>
                )}
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-[#8a986b]">
                Bispado {wardName || "Ala"}
              </p>
            </footer>
          </div>
        </article>
      </section>
    </section>
  );
}

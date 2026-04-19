function escapeCell(value: unknown) {
  const normalized = value === null || value === undefined ? "" : String(value);
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildCsv(rows: unknown[][]) {
  const lines = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  return `\uFEFF${lines}\n`;
}


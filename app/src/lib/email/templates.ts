type EmailTemplateInput = {
  preheader: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  ctaLabel: string;
  ctaUrl: string;
  footerNote?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildPlidEmailTemplate(input: EmailTemplateInput) {
  const rowsHtml = input.rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 0;color:#5f6f7d;font-size:13px;line-height:1.35;">
            <strong style="color:#12304a;">${escapeHtml(row.label)}:</strong>
            ${escapeHtml(row.value)}
          </td>
        </tr>
      `,
    )
    .join("");

  const html = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(input.preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efe8;padding:24px 0;font-family:Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #d9d0c2;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#0f7c86;padding:18px 24px;">
                <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d9f4f0;font-weight:700;">PLID</div>
                <div style="margin-top:6px;font-size:20px;line-height:1.25;color:#ffffff;font-weight:700;">Plataforma de Lideranca</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.25;color:#12304a;">${escapeHtml(input.title)}</h1>
                <p style="margin:0 0 16px 0;color:#4f6070;font-size:14px;line-height:1.5;">${escapeHtml(input.intro)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ee;border:1px solid #e5dccf;border-radius:10px;padding:12px 14px;">
                  ${rowsHtml}
                </table>
                <div style="margin-top:18px;">
                  <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#0f7c86;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-size:14px;font-weight:700;">
                    ${escapeHtml(input.ctaLabel)}
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px 24px;color:#6c7a86;font-size:12px;line-height:1.4;">
                ${escapeHtml(input.footerNote || "Este e um envio automatico do PLID.")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();

  const textRows = input.rows.map((row) => `${row.label}: ${row.value}`).join("\n");
  const text = [
    "PLID - Plataforma de Lideranca",
    "",
    input.title,
    input.intro,
    "",
    textRows,
    "",
    `${input.ctaLabel}: ${input.ctaUrl}`,
    "",
    input.footerNote || "Este e um envio automatico do PLID.",
  ].join("\n");

  return { html, text };
}


/**
 * Email templates for transactional emails.
 *
 * Each function returns { subject, text, html, category } ready for
 * queueEmail(). Keeping the templates in one place makes them easy to
 * review, redesign, and localize later.
 *
 * Brand colors are kept in sync with the landing site (notarix.live).
 */

const BRAND = {
  name: "Notarix",
  primary: "#1f4dde",
  primaryDark: "#1738a8",
  text: "#0f172a",
  muted: "#64748b",
  bg: "#f8fafc",
  cardBorder: "#e2e8f0",
};

const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Allow only safe URL schemes in href attributes. Anything else (javascript:,
 * data:, vbscript:, file:, etc.) is replaced with "#" so it can't execute.
 */
const safeUrl = (url) => {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  // Relative paths and hash/fragment-only links are fine.
  if (raw.startsWith("#") || raw.startsWith("/")) return raw;
  try {
    const parsed = new URL(raw);
    const allowed = new Set(["http:", "https:", "mailto:"]);
    if (!allowed.has(parsed.protocol)) return "#";
    return parsed.toString();
  } catch {
    // Not a parseable absolute URL. Allow only if it looks like a relative path.
    return /^[a-zA-Z0-9._~%/-]+(?:\?[a-zA-Z0-9._~%=&+-]*)?(?:#[a-zA-Z0-9._~%-]*)?$/.test(raw)
      ? raw
      : "#";
  }
};

const renderHtmlShell = ({ title, body, ctaLabel, ctaUrl, footerNote }) => {
  const safeCtaUrl = escapeHtml(safeUrl(ctaUrl));
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeFooterNote = escapeHtml(footerNote);
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.cardBorder};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:${BRAND.primary};padding:24px 28px;">
                <h1 style="margin:0;font-size:20px;color:#ffffff;letter-spacing:0.2px;">${BRAND.name}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h2 style="margin:0 0 12px 0;font-size:18px;color:${BRAND.text};">${title}</h2>
                ${body}
                ${
                  ctaUrl
                    ? `<p style="margin:28px 0 0 0;">
                         <a href="${safeCtaUrl}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${safeCtaLabel}</a>
                       </p>`
                    : ""
                }
                ${
                  safeFooterNote
                    ? `<p style="margin:24px 0 0 0;font-size:13px;color:${BRAND.muted};">${safeFooterNote}</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid ${BRAND.cardBorder};font-size:12px;color:${BRAND.muted};">
                &copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
};

/**
 * Build a temporary-password invite email for any role.
 *
 * @param {Object} params
 * @param {"Client"|"Notary"|"Admin"} params.role
 * @param {string} params.name           Recipient's display name
 * @param {string} params.email          Recipient's email
 * @param {string} params.temporaryPassword  Plain-text temp password (also shown to admin in response)
 * @param {string} params.loginUrl       Frontend login URL
 * @param {string} [params.resetUrl]     Optional password reset URL
 * @param {Object} [params.extra]        Role-specific extra info (company, permissions, etc.)
 * @returns {{subject: string, text: string, html: string, category: string}}
 */
export const buildInviteEmail = ({
  role,
  name,
  email,
  temporaryPassword,
  loginUrl,
  resetUrl,
  extra = {},
}) => {
  const subject = `Your ${BRAND.name} ${role.toLowerCase()} account is ready`;
  const category = `${role.toLowerCase()}-invite`;

  const roleCopy = {
    Client: {
      title: `Welcome to ${BRAND.name}`,
      intro: `Hello ${escapeHtml(name)}, your client account has been created by an administrator at ${BRAND.name}.`,
      extra: extra.company
        ? `<p style="margin:0 0 12px 0;color:${BRAND.muted};">Company: <strong>${escapeHtml(extra.company)}</strong></p>`
        : "",
    },
    Notary: {
      title: `Your notary account is ready`,
      intro: `Hello ${escapeHtml(name)}, your notary account has been created by an administrator at ${BRAND.name}.`,
      extra: extra.ronEligible
        ? `<p style="margin:0 0 12px 0;color:${BRAND.muted};">You are eligible for Remote Online Notarization (RON) assignments.</p>`
        : "",
    },
    Admin: {
      title: `You have been granted admin access`,
      intro: `Hello ${escapeHtml(name)}, you have been added as a ${escapeHtml(extra.adminRole || "admin")} on ${BRAND.name}.`,
      extra: Array.isArray(extra.permissions) && extra.permissions.length
        ? `<p style="margin:0 0 12px 0;color:${BRAND.muted};">Permissions: ${extra.permissions.map(escapeHtml).join(", ")}</p>`
        : "",
    },
  }[role] || {
    title: `Your ${BRAND.name} account is ready`,
    intro: `Hello ${escapeHtml(name)}, your account has been created.`,
    extra: "",
  };

  const ctaUrl = resetUrl || loginUrl;

  const body = `
    <p style="margin:0 0 16px 0;">${roleCopy.intro}</p>
    ${roleCopy.extra}
    <p style="margin:0 0 8px 0;">Your account has been created with the email address below. Use these credentials to sign in:</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BRAND.bg};border:1px solid ${BRAND.cardBorder};border-radius:8px;margin:0 0 8px 0;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;">
          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Account email</div>
            <div style="font-size:15px;font-weight:600;color:${BRAND.text};">${escapeHtml(email)}</div>
          </div>
          <div>
            <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Temporary password</div>
            <code style="display:inline-block;background:#ffffff;padding:4px 8px;border-radius:4px;border:1px solid ${BRAND.cardBorder};font-size:15px;font-weight:600;color:${BRAND.text};">${escapeHtml(temporaryPassword)}</code>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px 0;color:${BRAND.muted};font-size:13px;">Sign in with the email address <strong style="color:${BRAND.text};">${escapeHtml(email)}</strong> and the temporary password above.</p>
    <p style="margin:0;color:${BRAND.muted};font-size:14px;">For security, please sign in and reset your password on first login.</p>
  `;

  const html = renderHtmlShell({
    title: roleCopy.title,
    body,
    ctaLabel: "Sign in to Notarix",
    ctaUrl,
    footerNote:
      "If you did not expect this email, please contact your administrator and ignore this message.",
  });

  const text = [
    roleCopy.title,
    "",
    roleCopy.intro.replace(/<[^>]+>/g, ""),
    "",
    "Your account has been created. Use these credentials to sign in:",
    "",
    `  Account email:        ${email}`,
    `  Temporary password:   ${temporaryPassword}`,
    "",
    `Sign in with the email address ${email} and the temporary password above.`,
    "",
    "For security, please sign in and reset your password on first login.",
    ctaUrl ? `Sign in: ${ctaUrl}` : "",
    "",
    "If you did not expect this email, please contact your administrator and ignore this message.",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, text, html, category };
};
/**
 * LaTeX text escaping — prevents profile text, job descriptions,
 * or AI output from being interpreted as executable LaTeX commands.
 *
 * Characters escaped: \ { } $ & % # _ ^ ~
 * URLs are handled separately via \\url{} to avoid breaking special chars.
 */

const LATEX_SPECIAL = /[\\{}$&%#_^~]/g;
const LATEX_ESCAPE_MAP: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '$': '\\$',
  '&': '\\&',
  '%': '\\%',
  '#': '\\#',
  '_': '\\_',
  '^': '\\^{}',
  '~': '\\textasciitilde{}',
};

/** Escape ordinary text for use in LaTeX body text. */
export function escapeLatex(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(LATEX_SPECIAL, (ch) => LATEX_ESCAPE_MAP[ch] || ch);
}

/** Escape a URL using \\url{} — does not apply character escaping to the URL itself. */
export function escapeLatexUrl(url: string | null | undefined): string {
  if (!url) return '';
  // Percent signs in URLs break \\url when not escaped
  const safe = url.replace(/%/g, '\\%');
  return `\\url{${safe}}`;
}

/** Escape a short string for use in a LaTeX command argument — no newlines allowed. */
export function escapeLatexArg(text: string | null | undefined): string {
  if (!text) return '{}';
  const cleaned = escapeLatex(text).replace(/\n/g, ' ').trim();
  return `{${cleaned}}`;
}

/** Escape an optional string for a LaTeX command argument — returns empty braces if missing. */
export function escapeLatexOptional(text: string | null | undefined): string {
  if (!text || !text.trim()) return '';
  return escapeLatexArg(text);
}

/** Escape a list of strings as a comma-separated LaTeX-safe string. */
export function escapeLatexList(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return '';
  return items.map((s) => escapeLatex(s)).join(', ');
}

/** Wrap text in \\textbf{} if non-empty. */
export function bold(text: string | null | undefined): string {
  const e = escapeLatex(text);
  return e ? `\\textbf{${e}}` : '';
}

/** Wrap text in \\textit{} if non-empty. */
export function italic(text: string | null | undefined): string {
  const e = escapeLatex(text);
  return e ? `\\textit{${e}}` : '';
}
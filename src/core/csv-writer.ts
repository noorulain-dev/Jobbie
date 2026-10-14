/**
 * Lightweight RFC 4180 CSV serializer.
 * Handles commas, quotes, multiline values, Unicode, and formula injection.
 */
const BOM = '\uFEFF'; // UTF-8 BOM for Excel recognition

/** Characters that trigger Excel formula execution when at the start of a cell. */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/**
 * Escape a single CSV field value.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 * Prefixes with a tab character if the value starts with a formula trigger.
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);

  // Formula injection protection: prefix with tab if value starts with = + - @
  if (FORMULA_TRIGGERS.test(s)) {
    s = '\t' + s;
  }

  // Quote if contains comma, double-quote, newline, or leading/trailing whitespace
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r') || s !== s.trim()) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }

  return s;
}

/**
 * Serialize an array of row objects to a CSV string with UTF-8 BOM.
 * @param headers - Ordered array of column header names
 * @param rows - Array of objects with string/number/null values
 */
export function serializeCsv(headers: string[], rows: Array<Record<string, string | number | null | undefined>>): string {
  const lines: string[] = [BOM];

  // Header row
  lines.push(headers.map(h => escapeCsvField(h)).join(','));

  // Data rows
  for (const row of rows) {
    const values = headers.map(h => escapeCsvField(row[h] ?? ''));
    lines.push(values.join(','));
  }

  return lines.join('\r\n') + '\r\n';
}
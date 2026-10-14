import { CoverLetterContent } from '../types/latex-content.js';
import { escapeLatex } from './latex-escape.js';

/**
 * Build a complete LaTeX cover letter document from structured content.
 * Matching font and style with resume template.
 * Omits recipient/company details cleanly when unavailable.
 */
export function buildCoverLetterLatex(content: CoverLetterContent): string {
  const lines: string[] = [];

  // ── Preamble ──
  lines.push('\\documentclass[11pt,a4paper]{article}');
  lines.push('\\usepackage[margin=1in]{geometry}');
  lines.push('\\usepackage{hyperref}');
  lines.push('\\usepackage[T1]{fontenc}');
  lines.push('\\usepackage{charter}');
  lines.push('');
  lines.push('\\setlength{\\parindent}{0pt}');
  lines.push('\\setlength{\\parskip}{0.6em}');
  lines.push('');
  lines.push('\\hypersetup{colorlinks=true,linkcolor=black,urlcolor=blue}');
  lines.push('');
  lines.push('\\begin{document}');
  lines.push('');

  // ── Sender info (top right) ──
  const name = [content.firstName, content.lastName].filter(Boolean).join(' ');
  if (name || content.email || content.phone) {
    lines.push('\\begin{flushright}');
    if (name) lines.push(`{\\large \\textbf{${escapeLatex(name)}}}\\\\[2pt]`);
    if (content.email) lines.push(`{\\small ${escapeLatex(content.email)}}`);
    if (content.phone) lines.push(`{\\small ${escapeLatex(content.phone)}}`);
    lines.push('\\end{flushright}');
    lines.push('\\vspace{8pt}');
  }

  // ── Date ──
  if (content.date) {
    lines.push(escapeLatex(content.date));
    lines.push('\\vspace{12pt}');
  } else {
    lines.push('\\today');
    lines.push('\\vspace{12pt}');
  }

  // ── Recipient (only what's known) ──
  if (content.companyName) {
    lines.push(escapeLatex(content.companyName));
    lines.push('\\\\[2pt]');
  }
  if (content.roleTitle) {
    lines.push(`{\\small Re: ${escapeLatex(content.roleTitle)} position}`);
  }
  lines.push('\\vspace{16pt}');

  // ── Salutation ──
  // Never invent a hiring manager name — use neutral salutation
  lines.push('Dear Hiring Team,');
  lines.push('\\vspace{8pt}');

  // ── Body paragraphs ──
  if (content.paragraphs && content.paragraphs.length > 0) {
    for (const para of content.paragraphs) {
      lines.push(escapeLatex(para));
      lines.push('');
    }
  }

  // ── Closing ──
  lines.push('\\vspace{8pt}');
  lines.push(content.closing || 'Sincerely,');
  lines.push('\\vspace{24pt}');
  if (name) {
    lines.push(`\\textbf{${escapeLatex(name)}}`);
  }

  lines.push('\\end{document}');
  return lines.join('\n') + '\n';
}
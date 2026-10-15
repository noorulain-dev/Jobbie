import { CoverLetterContent } from '../types/latex-content.js';
import { escapeLatex } from './latex-escape.js';

// Readable short URL (strip https://)
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export function buildCoverLetterLatex(content: CoverLetterContent): string {
  const lines: string[] = [];
  const name = [content.firstName, content.lastName].filter(Boolean).join(' ') || 'Applicant';

  lines.push('\\documentclass[11pt,letterpaper]{letter}');
  lines.push('');
  lines.push('\\usepackage[margin=0.85in]{geometry}');
  lines.push('\\usepackage[T1]{fontenc}');
  lines.push('\\usepackage{lmodern}');
  lines.push('\\usepackage{microtype}');
  lines.push('\\usepackage{parskip}');
  lines.push('\\usepackage{xcolor}');
  lines.push('\\usepackage[hidelinks]{hyperref}');
  lines.push('');
  lines.push('\\definecolor{accent}{HTML}{234A68}');
  lines.push('\\definecolor{bodytext}{HTML}{252525}');
  lines.push('\\definecolor{muted}{HTML}{555555}');
  lines.push('');
  lines.push('\\renewcommand{\\familydefault}{\\sfdefault}');
  lines.push('\\color{bodytext}');
  lines.push('\\pagestyle{empty}');
  lines.push('\\setlength{\\parindent}{0pt}');
  lines.push('\\setlength{\\parskip}{8pt}');
  lines.push('\\setlength{\\emergencystretch}{2em}');
  lines.push('');
  lines.push('\\signature{\\textbf{' + escapeLatex(name) + '}}');
  lines.push('');
  lines.push('\\begin{document}');
  lines.push('');
  lines.push('\\begin{letter}{}');
  lines.push('');

  // Header
  lines.push('{\\fontsize{21}{25}\\selectfont');
  lines.push('\\bfseries\\color{accent}' + escapeLatex(name) + '\\par}');
  lines.push('');
  lines.push('\\vspace{3pt}');
  lines.push('');

  // Contact line
  const loc = [content.provinceState, content.country].filter(Boolean).join(', ');
  const contactA: string[] = [];
  if (loc) contactA.push(escapeLatex(loc));
  if (content.phone) contactA.push(escapeLatex(content.phone));
  if (content.email) contactA.push('\\href{mailto:' + (content.email || '') + '}{' + escapeLatex(content.email || '') + '}');
  if (contactA.length) {
    lines.push('{\\small');
    lines.push(contactA.join(' \\quad|\\quad '));
    lines.push('\\par}');
  }

  // Links
  const contactB: string[] = [];
  if (content.linkedin) contactB.push('\\href{' + content.linkedin + '}{' + escapeLatex(shortUrl(content.linkedin)) + '}');
  if (content.github) contactB.push('\\href{' + content.github + '}{' + escapeLatex(shortUrl(content.github)) + '}');
  if (contactB.length) {
    lines.push('{\\small');
    lines.push(contactB.join(' \\quad|\\quad '));
    lines.push('\\par}');
  }

  lines.push('');
  lines.push('\\vspace{5pt}');
  lines.push('{\\color{accent}\\rule{\\linewidth}{1.2pt}}');
  lines.push('');
  lines.push('\\vspace{12pt}');
  lines.push('');

  // Date
  const date = content.date || new Date().toISOString().slice(0,10);
  lines.push('\\textcolor{muted}{' + escapeLatex(date) + '}');
  lines.push('');
  lines.push('\\vspace{6pt}');
  lines.push('');

  // Recipient
  if (content.companyName) {
    lines.push('\\textbf{' + escapeLatex(content.companyName) + '}\\\\');
  }
  if (content.roleTitle) {
    lines.push(escapeLatex(content.roleTitle));
  }
  lines.push('');
  lines.push('\\vspace{8pt}');
  lines.push('');

  // Salutation
  lines.push('Dear Hiring Manager,');
  lines.push('');

  // Body
  if (content.paragraphs && content.paragraphs.length > 0) {
    for (const p of content.paragraphs) {
      lines.push(escapeLatex(p));
      lines.push('');
    }
  }

  // Closing
  lines.push('\\vspace{4pt}');
  lines.push('');
  lines.push('\\closing{Sincerely,}');
  lines.push('');
  lines.push('\\vspace{18pt}');
  lines.push('');

  lines.push('\\end{letter}');
  lines.push('\\end{document}');
  lines.push('');

  return lines.join('\n');
}

import { ResumeContent } from '../types/latex-content.js';
import { escapeLatex, escapeLatexUrl, escapeLatexList } from './latex-escape.js';

/**
 * Build a complete LaTeX resume document from structured content.
 * Uses a clean, ATS-friendly single-column layout.
 * Empty sections are omitted entirely — no broken commands.
 */
export function buildResumeLatex(content: ResumeContent): string {
  const lines: string[] = [];

  // ── Preamble ──
  lines.push('\\documentclass[11pt,a4paper]{article}');
  lines.push('\\usepackage[margin=0.75in]{geometry}');
  lines.push('\\usepackage{hyperref}');
  lines.push('\\usepackage{enumitem}');
  lines.push('\\usepackage[T1]{fontenc}');
  lines.push('\\usepackage{charter}');  // Clean serif font
  lines.push('');
  lines.push('\\setlength{\\parindent}{0pt}');
  lines.push('\\setlength{\\parskip}{0.4em}');
  lines.push('\\setlist{nosep,leftmargin=1.2em}');
  lines.push('');
  lines.push('\\hypersetup{colorlinks=true,linkcolor=black,urlcolor=blue}');
  lines.push('');
  lines.push('\\begin{document}');
  lines.push('');

  // ── Header / Contact ──
  const name = [content.firstName, content.lastName].filter(Boolean).join(' ');
  if (name) {
    lines.push(`{\\LARGE \\textbf{${escapeLatex(name)}}}\\\\[2pt]`);
  }

  const contactParts: string[] = [];
  if (content.email) contactParts.push(escapeLatex(content.email));
  if (content.phone) contactParts.push(escapeLatex(content.phone));
  if (content.city || content.provinceState) {
    contactParts.push(escapeLatex([content.city, content.provinceState].filter(Boolean).join(', ')));
  }
  if (contactParts.length) {
    lines.push(`{\\small ${contactParts.join(' \\\\textbar{} ')}}\\\\[2pt]`);
  }

  const linkParts: string[] = [];
  if (content.linkedin) linkParts.push(escapeLatexUrl(content.linkedin));
  if (content.github) linkParts.push(escapeLatexUrl(content.github));
  if (content.portfolio) linkParts.push(escapeLatexUrl(content.portfolio));
  if (linkParts.length) {
    lines.push(`{\\small ${linkParts.join(' \\\\textbar{} ')}}`);
  }

  lines.push('\\vspace{4pt}');
  lines.push('\\hrule');
  lines.push('\\vspace{6pt}');

  // ── Summary ──
  if (content.summary) {
    lines.push('\\section*{Professional Summary}');
    lines.push(escapeLatex(content.summary));
    lines.push('');
  }

  // ── Experience ──
  if (content.experience && content.experience.length > 0) {
    lines.push('\\section*{Experience}');
    for (const exp of content.experience) {
      const dates = [exp.startDate, exp.endDate || 'Present'].join(' -- ');
      lines.push(`\\textbf{${escapeLatex(exp.title)}} \\hfill {\\small ${escapeLatex(dates)}}`);
      lines.push(`\\textit{${escapeLatex(exp.company)}}${exp.location ? `, ${escapeLatex(exp.location)}` : ''}\\\\[2pt]`);
      if (exp.bullets && exp.bullets.length > 0) {
        lines.push('\\begin{itemize}');
        for (const b of exp.bullets) {
          lines.push(`  \\item ${escapeLatex(b)}`);
        }
        lines.push('\\end{itemize}');
      }
      if (exp.technologies && exp.technologies.length > 0) {
        lines.push(`{\\small \\textbf{Tech:} ${escapeLatexList(exp.technologies)}}\\\\[4pt]`);
      }
    }
  }

  // ── Education ──
  if (content.education && content.education.length > 0) {
    lines.push('\\section*{Education}');
    for (const ed of content.education) {
      const degree = [ed.degree, ed.major ? `in ${ed.major}` : ''].filter(Boolean).join(' ');
      const dates = [ed.startDate, ed.endDate].filter(Boolean).join(' -- ');
      lines.push(`\\textbf{${escapeLatex(degree)}} \\hfill {\\small ${escapeLatex(dates)}}`);
      lines.push(`\\textit{${escapeLatex(ed.institution)}}${ed.gpa ? `, GPA: ${escapeLatex(ed.gpa)}` : ''}\\\\[4pt]`);
    }
  }

  // ── Skills ──
  if (content.skills && content.skills.length > 0) {
    lines.push('\\section*{Technical Skills}');
    lines.push(escapeLatexList(content.skills));
    lines.push('');
  }

  // ── Projects ──
  if (content.projects && content.projects.length > 0) {
    lines.push('\\section*{Projects}');
    for (const proj of content.projects) {
      lines.push(`\\textbf{${escapeLatex(proj.name)}}${proj.url ? ` \\\\textbar{} ${escapeLatexUrl(proj.url)}` : ''}\\\\[2pt]`);
      lines.push(escapeLatex(proj.description));
      if (proj.technologies && proj.technologies.length > 0) {
        lines.push(`\\\\[2pt]{\\small \\textbf{Tech:} ${escapeLatexList(proj.technologies)}}`);
      }
      lines.push('\\\\[6pt]');
    }
  }

  // ── Certifications ──
  if (content.certifications && content.certifications.length > 0) {
    lines.push('\\section*{Certifications}');
    lines.push('\\begin{itemize}');
    for (const cert of content.certifications) {
      lines.push(`  \\item ${escapeLatex(cert)}`);
    }
    lines.push('\\end{itemize}');
  }

  // ── Languages ──
  if (content.languages && content.languages.length > 0) {
    lines.push('\\section*{Languages}');
    lines.push(escapeLatexList(content.languages));
    lines.push('');
  }

  // ── Awards ──
  if (content.awards && content.awards.length > 0) {
    lines.push('\\section*{Awards}');
    lines.push('\\begin{itemize}');
    for (const award of content.awards) {
      lines.push(`  \\item ${escapeLatex(award)}`);
    }
    lines.push('\\end{itemize}');
  }

  lines.push('\\end{document}');
  return lines.join('\n') + '\n';
}
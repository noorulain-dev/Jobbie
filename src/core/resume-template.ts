import { ResumeContent } from '../types/latex-content.js';
import { escapeLatex, escapeLatexList } from './latex-escape.js';

function hrefUrl(url: string): string {
  if (!url) return '';
  const display = url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const esc = display.replace(/%/g, '\\%').replace(/#/g, '\\#').replace(/_/g, '\\_');
  return '\\href{' + url.replace(/%/g, '\\%').replace(/#/g, '\\#') + '}{' + esc + '}';
}

export function buildResumeLatex(content: ResumeContent): string {
  const lines: string[] = [];
  lines.push('\\documentclass[letterpaper,10pt]{article}');
  lines.push('');
  lines.push('\\usepackage[empty]{fullpage}');
  lines.push('\\usepackage{titlesec}');
  lines.push('\\usepackage[usenames,dvipsnames]{color}');
  lines.push('\\usepackage{enumitem}');
  lines.push('\\usepackage[hidelinks]{hyperref}');
  lines.push('\\usepackage{geometry}');
  lines.push('');
  lines.push('\\geometry{left=0.5in, top=0.4in, right=0.5in, bottom=0.4in}');
  lines.push('');
  lines.push('\\urlstyle{same}');
  lines.push('\\raggedbottom');
  lines.push('\\raggedright');
  lines.push('\\setlength{\\tabcolsep}{0in}');
  lines.push('');
  lines.push('\\titleformat{\\section}{');
  lines.push('  \\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries');
  lines.push('}{}{0em}{}[\\color{black}\\vspace{-2pt}\\hrule\\vspace{-4pt}]');
  lines.push('');
  lines.push('\\newcommand{\\resumeItem}[1]{ \\item\\small{#1 \\vspace{-2pt}} }');
  lines.push('\\newcommand{\\resumeSubheading}[4]{');
  lines.push('  \\vspace{-2pt}\\item[]');
  lines.push('    \\begin{tabular*}{\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}');
  lines.push('      \\textbf{#1} & #2 \\\\');
  lines.push('      \\textit{\\small#3} & \\textit{\\small #4} \\\\');
  lines.push('    \\end{tabular*}\\vspace{-6pt}');
  lines.push('}');
  lines.push('\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}');
  lines.push('\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}');
  lines.push('\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=0.15in]}');
  lines.push('\\newcommand{\\resumeItemListEnd}{\\end{itemize}}');
  lines.push('');
  lines.push('\\begin{document}');
  lines.push('');

  const name = [content.firstName, content.lastName].filter(Boolean).join(' ');
  lines.push('\\begin{center}');
  if (name) lines.push('    {\\Huge \\scshape ' + escapeLatex(name) + '} \\\\ \\vspace{4pt}');
  if (content.headline) lines.push('    \\small ' + escapeLatex(content.headline) + ' \\\\ \\vspace{3pt}');
  const loc = [content.provinceState, content.country].filter(Boolean).join(', ');
  const contactA: string[] = [];
  if (loc) contactA.push(escapeLatex(loc));
  if (content.phone) contactA.push(escapeLatex(content.phone));
  if (content.email) contactA.push('\\href{mailto:' + content.email + '}{' + escapeLatex(content.email) + '}');
  if (contactA.length) lines.push('    \\small ' + contactA.join(' $|$ ') + ' \\\\ \\vspace{2pt}');
  const contactB: string[] = [];
  if (content.linkedin) contactB.push(hrefUrl(content.linkedin));
  if (content.github) contactB.push(hrefUrl(content.github));
  if (contactB.length) lines.push('    ' + contactB.join(' $|$ '));
  lines.push('\\end{center}');
  lines.push('');

  if (content.summary) {
    lines.push('\\section{Professional Summary}');
    lines.push('\\small{');
    lines.push(escapeLatex(content.summary));
    lines.push('}');
    lines.push('');
  }

  if (content.skillGroups && content.skillGroups.length > 0) {
    lines.push('\\section{Technical Skills}');
    lines.push('\\begin{itemize}[leftmargin=0.15in, label={}]');
    lines.push('    \\small{\\item{');
    for (const group of content.skillGroups) {
      if (!group.skills.length) continue;
      lines.push('        \\textbf{' + escapeLatex(group.category) + ':} ' + escapeLatexList(group.skills) + ' \\\\');
    }
    lines.push('    }}');
    lines.push('\\end{itemize}');
    lines.push('');
  } else if (content.skills && content.skills.length > 0) {
    lines.push('\\section{Technical Skills}');
    lines.push('\\begin{itemize}[leftmargin=0.15in, label={}]');
    lines.push('    \\small{\\item{' + escapeLatexList(content.skills) + '}}');
    lines.push('\\end{itemize}');
    lines.push('');
  }
  if (content.experience && content.experience.length > 0) {
    lines.push('\\section{Professional Experience}');
    lines.push('\\resumeSubHeadingListStart');
    for (const exp of content.experience) {
      const dates = [exp.startDate, exp.endDate || 'Present'].join(' -- ');
      const loc = exp.location ? escapeLatex(exp.location) : '';
      lines.push('    \\resumeSubheading');
      lines.push('      {' + escapeLatex(exp.title) + '}{' + escapeLatex(dates) + '}');
      lines.push('      {' + escapeLatex(exp.company) + '}{' + loc + '}');
      lines.push('      \\resumeItemListStart');
      for (const b of exp.bullets) lines.push('        \\resumeItem{' + escapeLatex(b) + '}');
      lines.push('      \\resumeItemListEnd');
    }
    lines.push('\\resumeSubHeadingListEnd');
    lines.push('');
  }

  if (content.projects && content.projects.length > 0) {
    lines.push('\\section{Selected Projects}');
    lines.push('\\resumeSubHeadingListStart');
    for (const proj of content.projects) {
      const url = proj.url ? hrefUrl(proj.url) : '';
      lines.push('    \\resumeSubheading');
      lines.push('      {' + escapeLatex(proj.name) + '}{' + url + '}');
      lines.push('      {}{}');
      lines.push('      \\vspace{-12pt}');
      lines.push('      \\resumeItemListStart');
      lines.push('        \\resumeItem{' + escapeLatex(proj.description) + '}');
      if (proj.measurableOutcomes && proj.measurableOutcomes.length > 0) {
        lines.push('        \\resumeItem{\\textbf{' + escapeLatex(proj.measurableOutcomes.join('; ')) + '}}');
      }
      lines.push('      \\resumeItemListEnd');
    }
    lines.push('\\resumeSubHeadingListEnd');
    lines.push('');
  }

  if (content.education && content.education.length > 0) {
    lines.push('\\section{Education}');
    lines.push('\\resumeSubHeadingListStart');
    for (const ed of content.education) {
      const degree = ed.degree || '';
      const grad = ed.endDate ? 'Graduated ' + ed.endDate : '';
      lines.push('    \\resumeSubheading');
      lines.push('      {' + escapeLatex(ed.institution) + '}{}');
      lines.push('      {' + escapeLatex(degree) + '}{' + escapeLatex(grad) + '}');
      if (ed.major) {
        lines.push('      \\resumeItemListStart');
        lines.push('        \\resumeItem{\\textbf{Majors:} ' + escapeLatex(ed.major) + '}');
        lines.push('      \\resumeItemListEnd');
      }
    }
    lines.push('\\resumeSubHeadingListEnd');
    lines.push('');
  }

  if (content.certifications && content.certifications.length > 0) {
    lines.push('\\section{Certifications}');
    lines.push('\\begin{itemize}[leftmargin=0.15in]');
    for (const cert of content.certifications) lines.push('    \\item \\small{' + escapeLatex(cert) + '}');
    lines.push('\\end{itemize}');
    lines.push('');
  }

  lines.push('\\end{document}');
  return lines.join('\n') + '\n';
}

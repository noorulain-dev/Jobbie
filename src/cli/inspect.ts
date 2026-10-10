import { ProfileStorage } from '../core/storage.js';
import { ProfileProjector } from '../core/projector.js';

async function inspectProfile() {
  console.log('='.repeat(70));
  console.log('             JOBBY CAREER BRAIN - MASTER PROFILE INSPECTION');
  console.log('='.repeat(70));

  const storage = new ProfileStorage();
  const master = storage.getMasterProfile();

  if (!master) {
    console.error('\n❌ No Master Profile found in database or data/profile/master-profile.json.');
    console.log('Run `pnpm run seed` first to import your profile seed.\n');
    storage.close();
    process.exit(1);
  }

  // 1. Personal & Contact Info
  console.log('\n📋 1. PERSONAL INFORMATION');
  console.log('-'.repeat(70));
  console.log(`  Name:        ${master.personal.firstName} ${master.personal.lastName}`);
  console.log(`  Email:       ${master.personal.email}`);
  console.log(`  Phone:       ${master.personal.phone}`);
  console.log(`  Location:    ${master.personal.city}, ${master.personal.provinceState}, ${master.personal.country}`);
  console.log(`  LinkedIn:    ${master.personal.linkedin}`);
  console.log(`  GitHub:      ${master.personal.github}`);
  console.log(`  Portfolio:   ${master.personal.portfolio}`);
  console.log(`  Provenance:  [${master.personal.provenance.provenance.toUpperCase()}] Source: ${master.personal.provenance.sourceRef}`);

  // 2. Work Screening
  console.log('\n📋 2. WORK SCREENING');
  console.log('-'.repeat(70));
  console.log(`  Work Auth:      ${master.screening.workAuthorization}`);
  console.log(`  Sponsorship:    ${master.screening.sponsorshipRequired}`);
  console.log(`  Target Salary:  ${master.screening.targetSalary}`);
  console.log(`  Notice Period:  ${master.screening.noticePeriod}`);
  console.log(`  Experience:     ${master.screening.yearsExperience}`);
  console.log(`  Remote Policy:  ${master.screening.remoteEligibility}`);
  console.log(`  Provenance:     [${master.screening.provenance.provenance.toUpperCase()}]`);

  // 3. Education
  console.log('\n🎓 3. EDUCATION');
  console.log('-'.repeat(70));
  for (const edu of master.education) {
    console.log(`  • ${edu.degree}${edu.major ? ` (${edu.major})` : ''}`);
    console.log(`    ${edu.institution} | ${edu.location} | Status: ${edu.status}${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}`);
  }

  // 4. Experience
  console.log('\n💼 4. EXPERIENCE');
  console.log('-'.repeat(70));
  for (const exp of master.experience) {
    console.log(`  • ${exp.company} — ${exp.title}`);
    console.log(`    Dates: ${exp.startDate} - ${exp.endDate} | Location: ${exp.location} | Type: ${exp.employmentType}`);
    console.log(`    Bullets (${exp.bulletPoints.length}):`);
    for (const b of exp.bulletPoints) {
      console.log(`      - ${b.text}`);
    }
  }

  // 5. Projects
  console.log('\n🚀 5. PROJECTS');
  console.log('-'.repeat(70));
  for (const proj of master.projects) {
    console.log(`  • ${proj.name} ${proj.url ? `(${proj.url})` : ''}`);
    if (proj.technologies.length > 0) {
      console.log(`    Tech: ${proj.technologies.join(', ')}`);
    }
    console.log(`    Description: ${proj.description}`);
  }

  // 6. Skills Summary by Category
  console.log('\n⚡ 6. SKILLS TAXONOMY & EVIDENCE');
  console.log('-'.repeat(70));
  console.log(`  Total Indexed Skills: ${master.skills.length}`);

  const byCategory: Record<string, typeof master.skills> = {};
  for (const skill of master.skills) {
    byCategory[skill.category] = byCategory[skill.category] || [];
    byCategory[skill.category].push(skill);
  }

  for (const [cat, skills] of Object.entries(byCategory)) {
    console.log(`\n  Category: [${cat}] (${skills.length} skills)`);
    for (const s of skills) {
      const aliasStr = s.aliases.length > 0 ? ` [aliases: ${s.aliases.join(', ')}]` : '';
      const evidenceStr = s.evidence.length > 0 ? ` (${s.evidence.length} evidence links)` : '';
      console.log(`    - ${s.name} (${s.status})${aliasStr}${evidenceStr}`);
    }
  }

  // 7. Career Profile Projections
  console.log('\n🎯 7. CAREER PROFILE PROJECTIONS');
  console.log('-'.repeat(70));
  const careerProfiles = storage.getCareerProfiles();
  console.log(`  Active Configurations (${careerProfiles.length}):`);

  for (const cp of careerProfiles) {
    const { primary, secondary, deemphasized, other } = ProfileProjector.projectSkills(master, cp);
    const { prioritized, standard: stdExps } = ProfileProjector.projectExperiences(master, cp);
    const { highlighted, standard: stdProjs } = ProfileProjector.projectProjects(master, cp);

    console.log(`\n  [Track: ${cp.track}] ${cp.name} (ID: ${cp.id})`);
    console.log(`  Description: ${cp.description}`);
    console.log(`  Headline: "${cp.headline}"`);
    console.log(`  Target Roles: ${cp.targetJobTitles.join(', ')}`);
    if (cp.excludedJobTitles.length > 0) {
      console.log(`  Excluded Roles: ${cp.excludedJobTitles.join(', ')}`);
    }
    console.log(`  Preferred Industries: ${cp.preferredIndustries.join(', ')}`);
    console.log(`  Priority Skills (${primary.length}): ${primary.map((s) => s.name).join(', ')}`);
    console.log(`  Secondary Skills (${secondary.length}): ${secondary.map((s) => s.name).join(', ')}`);
    if (deemphasized.length > 0) {
      console.log(`  De-emphasized Skills (${deemphasized.length}): ${deemphasized.map((s) => s.name).join(', ')}`);
    }
    console.log(`  Priority Experiences (${prioritized.length}): ${prioritized.map((e) => e.company).join(', ')}`);
    console.log(`  Highlighted Projects (${highlighted.length}): ${highlighted.map((p) => p.name).join(', ')}`);
    console.log(`  Preferred Keywords: ${cp.preferredKeywords.join(', ')}`);
    console.log(`  Salary / Comp Prefs: Target ${cp.salaryPreferences.target} ${cp.salaryPreferences.currency}/${cp.salaryPreferences.period}`);
    console.log(`  Seniority Prefs: ${cp.seniorityPreferences.targetLevels.join(', ')} (${cp.seniorityPreferences.yearsExperienceClaim})`);
  }

  // 8. Conflicts Quarantine
  console.log('\n⚖️  8. CONFLICTS STATUS');
  console.log('-'.repeat(70));
  const conflicts = storage.getDatabase().getConflicts(true);
  if (conflicts.length === 0) {
    console.log('  ✓ No pending conflicts. All data is clean and consistent.');
  } else {
    console.log(`  ⚠️  ${conflicts.length} pending conflict(s) requiring review:`);
    for (const c of conflicts) {
      console.log(`    - Field: ${c.factPath}`);
    }
  }

  storage.close();
  console.log('\n' + '='.repeat(70));
  console.log('                 INSPECTION COMPLETE: OK');
  console.log('='.repeat(70) + '\n');
}

inspectProfile().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});

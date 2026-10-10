import { ProfileStorage } from '../core/storage.js';
import { SkillIntelligenceService } from '../core/skill-intelligence.js';

async function runEnrichmentCLI() {
  console.log('='.repeat(70));
  console.log('           JOBBY SKILL INTELLIGENCE LAYER - ENRICHMENT AUDIT');
  console.log('='.repeat(70));

  const storage = new ProfileStorage();
  const master = storage.getMasterProfile();

  if (!master) {
    console.error('❌ No Master Profile found. Run `pnpm run seed` first.');
    process.exit(1);
  }

  const service = new SkillIntelligenceService();

  // 1. Build and display skill registry sample
  const registry = service.buildRegistry(master);
  console.log(`\n📊 1. SKILL REGISTRY OVERVIEW`);
  console.log(`  Total Active Skills Registered: ${registry.length}`);
  const knownCount = registry.filter((r) => r.claimability.canClaimOnResume).length;
  const restrictedCount = registry.filter((r) => !r.claimability.canClaimOnResume).length;
  console.log(`  - Known & Claimable on Resume/Screening: ${knownCount}`);
  console.log(`  - Restricted (Targets, Prohibited, Pending): ${restrictedCount}`);

  // 2. Discover inferred skills (recommendations)
  console.log(`\n🔍 2. INFERRED / RELATED SKILLS DISCOVERY`);
  console.log(`  Scanning documented experience and skills for omitted essentials...`);

  const suggestions = await service.discoverInferredSkills(master, { useSemanticAI: false });

  if (suggestions.length === 0) {
    console.log('  No omitted skills detected.');
  } else {
    console.log(`  Found ${suggestions.length} inferred skill recommendation(s) for review:`);
    for (const sugg of suggestions) {
      console.log(`\n  • [${sugg.canonicalName}] (Category: ${sugg.category})`);
      console.log(`    Status: ${sugg.status}`);
      console.log(`    Derived From: ${sugg.derivedFromSkill || 'Experience'}`);
      console.log(`    Rationale: ${sugg.rationale}`);
      if (sugg.aliases.length > 0) {
        console.log(`    Aliases: ${sugg.aliases.join(', ')}`);
      }
      if (sugg.evidence.length > 0) {
        console.log(`    Linked Evidence: ${sugg.evidence.length} reference(s)`);
      }
    }
  }

  console.log(`\n💡 3. ONE-TIME APPROVAL FLOW`);
  console.log('  To approve an inferred skill and persist it as USER_APPROVED_KNOWN:');
  console.log('  Call `service.approveInferredSkill(master, suggestion, optionalNotes)`');
  console.log('  Then save with `storage.saveMasterProfile(updatedMaster, reason)`');

  storage.close();
  console.log('\n' + '='.repeat(70));
  console.log('                 SKILL AUDIT COMPLETE: OK');
  console.log('='.repeat(70) + '\n');
}

runEnrichmentCLI().catch((err) => {
  console.error('Skill enrichment CLI failed:', err);
  process.exit(1);
});

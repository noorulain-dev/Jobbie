import { MasterProfile } from '../types/master-profile.js';
import { ProfileFieldDiff } from '../types/provenance.js';

/**
 * Computes deep field-level differences between two MasterProfile versions.
 */
export function computeProfileDiff(
  oldProfile: MasterProfile | null,
  newProfile: MasterProfile
): ProfileFieldDiff[] {
  const diffs: ProfileFieldDiff[] = [];

  if (!oldProfile) {
    diffs.push({
      fieldPath: 'profile',
      previousValue: null,
      newValue: 'Initial Profile Created',
      action: 'created',
    });
    return diffs;
  }

  // 1. Personal fields
  const personalFields = ['firstName', 'lastName', 'email', 'phone', 'city', 'provinceState', 'country', 'linkedin', 'github', 'portfolio'] as const;
  for (const field of personalFields) {
    if (oldProfile.personal[field] !== newProfile.personal[field]) {
      diffs.push({
        fieldPath: `personal.${field}`,
        previousValue: oldProfile.personal[field],
        newValue: newProfile.personal[field],
        action: 'updated',
      });
    }
  }

  // 2. Screening fields
  const screeningFields = ['workAuthorization', 'sponsorshipRequired', 'targetSalary', 'noticePeriod', 'yearsExperience', 'remoteEligibility'] as const;
  for (const field of screeningFields) {
    if (oldProfile.screening[field] !== newProfile.screening[field]) {
      diffs.push({
        fieldPath: `screening.${field}`,
        previousValue: oldProfile.screening[field],
        newValue: newProfile.screening[field],
        action: 'updated',
      });
    }
  }

  // 3. Array sections helper (by id or name/title)
  const compareEntityLists = (
    sectionName: string,
    oldList: any[],
    newList: any[],
    identifierKey: string,
    labelKey: string
  ) => {
    const oldMap = new Map(oldList.map((item) => [item[identifierKey] || item[labelKey], item]));
    const newMap = new Map(newList.map((item) => [item[identifierKey] || item[labelKey], item]));

    // Check added or updated
    for (const [key, newItem] of newMap.entries()) {
      const oldItem = oldMap.get(key);
      const label = newItem[labelKey] || key;
      if (!oldItem) {
        diffs.push({
          fieldPath: `${sectionName}[${label}]`,
          previousValue: null,
          newValue: label,
          action: 'created',
        });
      } else {
        // Simple JSON diff for changes
        const oldStr = JSON.stringify(oldItem);
        const newStr = JSON.stringify(newItem);
        if (oldStr !== newStr) {
          diffs.push({
            fieldPath: `${sectionName}[${label}]`,
            previousValue: oldItem,
            newValue: newItem,
            action: 'updated',
          });
        }
      }
    }

    // Check deleted
    for (const [key, oldItem] of oldMap.entries()) {
      if (!newMap.has(key)) {
        const label = oldItem[labelKey] || key;
        diffs.push({
          fieldPath: `${sectionName}[${label}]`,
          previousValue: label,
          newValue: null,
          action: 'deleted',
        });
      }
    }
  };

  compareEntityLists('skills', oldProfile.skills, newProfile.skills, 'id', 'name');
  compareEntityLists('experience', oldProfile.experience, newProfile.experience, 'id', 'company');
  compareEntityLists('projects', oldProfile.projects, newProfile.projects, 'id', 'name');
  compareEntityLists('education', oldProfile.education, newProfile.education, 'id', 'degree');
  compareEntityLists('certifications', oldProfile.certifications, newProfile.certifications, 'id', 'title');
  compareEntityLists('awards', oldProfile.awards, newProfile.awards, 'id', 'title');
  compareEntityLists('leadership', oldProfile.leadership || [], newProfile.leadership || [], 'id', 'role');
  compareEntityLists('languages', oldProfile.languages || [], newProfile.languages || [], 'id', 'language');

  return diffs;
}

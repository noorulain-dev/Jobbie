import crypto from 'node:crypto';
import { normalizeSkillName } from './skill-normalizer.js';
import { RemoteStatus, SeniorityLevel } from '../types/job.js';

/**
 * 1. Company Name Normalization
 * Strips legal suffixes (Inc, LLC, Corp, Ltd, Co, Technologies, Systems, etc.),
 * punctuation, and excessive whitespace.
 */
export function normalizeCompanyName(company: string): string {
  if (!company) return '';
  return company
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Strip punctuation
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|technologies|tech|solutions|systems|group|holdings|services|gmbh|sa|pvt|plc)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 2. Job Title Normalization
 * Standardizes common level variations (e.g., II -> 2, III -> 3, Sr. -> senior),
 * removes brackets/parenthetical noise, punctuation, and formats canonical terms.
 */
export function normalizeJobTitle(title: string): string {
  if (!title) return '';

  let normalized = title.toLowerCase();

  // Normalize Roman numeral levels & common seniority abbreviations
  normalized = normalized
    .replace(/\b(sr\.?|snr\.?)\b/gi, 'senior')
    .replace(/\b(jr\.?|jnr\.?)\b/gi, 'junior')
    .replace(/\b(mid-level|mid level)\b/gi, 'mid')
    .replace(/\b(prin\.?)\b/gi, 'principal')
    .replace(/\b(lead\/staff)\b/gi, 'lead')
    .replace(/\b(sw\/swe)\b/gi, 'software engineer')
    .replace(/\b(qa)\b/gi, 'quality assurance')
    .replace(/\b(ai\/ml)\b/gi, 'ai ml');

  // Convert Roman numerals to Arabic numbers when referring to levels
  normalized = normalized
    .replace(/\b(iv)\b/gi, '4')
    .replace(/\b(iii)\b/gi, '3')
    .replace(/\b(ii)\b/gi, '2')
    .replace(/\b(i)\b/gi, '1');

  // Strip non-alphanumeric punctuation
  normalized = normalized
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Extracts standard seniority level deterministically from title or text.
 */
export function extractSeniorityLevel(text: string): SeniorityLevel {
  const lower = text.toLowerCase();
  if (/\b(intern|internship|co-?op)\b/i.test(lower)) return 'intern';
  if (/\b(principal|fellow|distinguished)\b/i.test(lower)) return 'principal';
  if (/\b(staff)\b/i.test(lower)) return 'staff';
  if (/\b(lead|team lead|tech lead|head)\b/i.test(lower)) return 'lead';
  if (/\b(vp|vice president|director|c-level|cto|ceo|executive)\b/i.test(lower)) return 'executive';
  if (/\b(sr|senior|level 3|level iii|level 4|level iv)\b/i.test(lower)) return 'senior';
  if (/\b(jr|junior|entry|entry-level|graduate|associate|level 1|level i)\b/i.test(lower)) return 'entry';
  if (/\b(mid|mid-level|intermediate|level 2|level ii)\b/i.test(lower) || /\bii\b/i.test(lower) || /\b2\b/.test(lower)) return 'mid';
  return 'unknown';
}


/**
 * 3. URL Normalization
 * Removes tracking params (utm_*, ref, source, trackingId, vjk, etc.), trailing slashes,
 * and standardizes protocol and host casing.
 */
export function normalizeJobUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl.trim());
    const paramsToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      const k = key.toLowerCase();
      if (
        k.startsWith('utm_') ||
        k === 'ref' ||
        k === 'source' ||
        k === 'trackingid' ||
        k === 'refid' ||
        k === 'fref' ||
        k === 'trk' ||
        k === 'trkinfo' ||
        k === 'original_referer' ||
        k === 'fbclid' ||
        k === 'gclid' ||
        k === 'gh_src' ||
        k === 'currentjobid'
      ) {
        paramsToDelete.push(key);
      }
    });

    for (const p of paramsToDelete) {
      url.searchParams.delete(p);
    }

    let pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';

    url.searchParams.sort();
    const search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';

    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${pathname}${search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * 4. Location & Remote Status Normalization
 * Normalizes permutations like:
 * "Remote - Canada", "Canada - Remote", "Remote (Canada)" -> "canada:remote"
 */
export function normalizeJobLocation(rawLocation: string): {
  city: string | null;
  region: string | null;
  country: string | null;
  remoteStatus: RemoteStatus;
  canonicalString: string;
} {
  if (!rawLocation) {
    return {
      city: null,
      region: null,
      country: null,
      remoteStatus: 'unknown',
      canonicalString: 'unknown',
    };
  }

  const rawLower = rawLocation.toLowerCase().trim();

  let remoteStatus: RemoteStatus = 'unknown';
  if (/\b(remote|work from home|telecommute|anywhere|virtual)\b/i.test(rawLower)) {
    if (/\b(hybrid|partially remote|flexible)\b/i.test(rawLower)) {
      remoteStatus = 'hybrid';
    } else {
      remoteStatus = 'remote';
    }
  } else if (/\b(hybrid|flexible)\b/i.test(rawLower)) {
    remoteStatus = 'hybrid';
  } else if (/\b(on-?site|in-?office|in person)\b/i.test(rawLower)) {
    remoteStatus = 'onsite';
  }

  // Country detection
  let country: string | null = null;
  if (/\b(canada|canadian)\b/i.test(rawLower)) {
    country = 'Canada';
  } else if (/\b(united states|usa|u\.s\.a?|us)\b/i.test(rawLower)) {
    country = 'United States';
  } else if (/\b(united kingdom|uk|great britain|england)\b/i.test(rawLower)) {
    country = 'United Kingdom';
  } else if (/\b(germany|deutschland)\b/i.test(rawLower)) {
    country = 'Germany';
  }

  // Region / State / Province
  let region: string | null = null;
  if (/\b(california)\b/i.test(rawLower) || (/\bca\b/i.test(rawLower) && country !== 'Canada')) {
    region = 'California';
    if (!country) country = 'United States';
  } else if (/\b(ontario)\b/i.test(rawLower) || (/\bon\b/i.test(rawLower) && !/\bon-?site\b/i.test(rawLower))) {
    region = 'Ontario';
    if (!country) country = 'Canada';
  } else if (/\b(british columbia|bc)\b/i.test(rawLower)) {
    region = 'British Columbia';
    if (!country) country = 'Canada';
  } else if (/\b(quebec|qc)\b/i.test(rawLower)) {
    region = 'Quebec';
    if (!country) country = 'Canada';
  } else if (/\b(new york|ny)\b/i.test(rawLower)) {
    region = 'New York';
    if (!country) country = 'United States';
  } else if (/\b(texas|tx)\b/i.test(rawLower)) {
    region = 'Texas';
    if (!country) country = 'United States';
  } else if (/\b(washington|wa)\b/i.test(rawLower)) {
    region = 'Washington';
    if (!country) country = 'United States';
  }


  // City detection
  let city: string | null = null;
  if (/\b(toronto)\b/i.test(rawLower)) city = 'Toronto';
  else if (/\b(vancouver)\b/i.test(rawLower)) city = 'Vancouver';
  else if (/\b(montreal)\b/i.test(rawLower)) city = 'Montreal';
  else if (/\b(ottawa)\b/i.test(rawLower)) city = 'Ottawa';
  else if (/\b(san francisco|sf)\b/i.test(rawLower)) city = 'San Francisco';
  else if (/\b(seattle)\b/i.test(rawLower)) city = 'Seattle';
  else if (/\b(austin)\b/i.test(rawLower)) city = 'Austin';

  // Build canonical string (sorted parts ignoring original order or punctuation)
  const canonicalParts: string[] = [];
  if (country) canonicalParts.push(country.toLowerCase());
  if (region) canonicalParts.push(region.toLowerCase());
  if (city) canonicalParts.push(city.toLowerCase());
  if (remoteStatus !== 'unknown') canonicalParts.push(remoteStatus);

  if (canonicalParts.length === 0) {
    canonicalParts.push(rawLower.replace(/[^\w]/g, ' ').replace(/\s+/g, ' ').trim());
  }

  const canonicalString = canonicalParts.sort().join(':');

  return {
    city,
    region,
    country,
    remoteStatus,
    canonicalString,
  };
}

/**
 * 5. Technology & Skill Name Normalization
 */
export function normalizeTechnologyName(tech: string): string {
  if (!tech) return '';
  return normalizeSkillName(tech).canonical;
}

/**
 * 6. Deterministic Deduplication Hash
 * Computes an SHA-256 fingerprint from company + normalized title + location.
 */
export function computeJobDedupHash(params: {
  companyName: string;
  jobTitle: string;
  rawLocation?: string;
}): string {
  const normComp = normalizeCompanyName(params.companyName);
  const normTitle = normalizeJobTitle(params.jobTitle);
  const normLoc = normalizeJobLocation(params.rawLocation || '').canonicalString;

  const composite = `${normComp}|${normTitle}|${normLoc}`;
  return crypto.createHash('sha256').update(composite).digest('hex');
}


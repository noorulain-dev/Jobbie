import { FillPolicyDecision, FillPolicyLevel } from '../types/page-fill.js';

/**
 * Centralized Page Fill Policy Guard
 *
 * Determines whether Jobby may read and write form fields on a given application page,
 * or must restrict itself to suggestion-only mode, or skip the page entirely.
 *
 * This is NOT a general-purpose site-adapter framework. It is a single, reviewable
 * policy file that encodes known restrictions for platforms where automated page
 * modification would violate terms of service or risk detection.
 *
 * ── Policy Rules ────────────────────────────────────────────────
 * - LinkedIn jobs and application pages → assisted_only (suggest answers only)
 * - Indeed application pages → assisted_only (suggest answers only)
 * - All other pages → allowed (read and write form fields)
 * - Pages on skip list → skip
 *
 * ── Why assisted_only for LinkedIn / Indeed ─────────────────────
 * These platforms explicitly prohibit automated form interaction in their ToS.
 * Jobby provides copy-ready answers in the popup UI without touching the DOM,
 * so the user remains in full control and the site's JavaScript is unaffected.
 */

const ASSISTED_ONLY_DOMAINS = [
  'linkedin.com',
  'indeed.com',
];

const SKIP_DOMAINS: string[] = [
  // Add domains here if Jobby must never interact with them
];

export function resolveFillPolicy(pageUrl: string): FillPolicyDecision {
  let hostname = '';
  try {
    hostname = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return { level: 'skip', reason: `Invalid page URL: ${pageUrl}` };
  }

  // Check skip list first
  for (const domain of SKIP_DOMAINS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return { level: 'skip', reason: `Domain '${hostname}' is on the skip list.` };
    }
  }

  // Check assisted-only domains
  for (const domain of ASSISTED_ONLY_DOMAINS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return {
        level: 'assisted_only',
        reason: `Domain '${hostname}' requires assisted-only mode (suggest answers without DOM modification).`,
      };
    }
  }

  // Default: full fill allowed
  return {
    level: 'allowed',
    reason: `Domain '${hostname}' is not restricted. Full fill allowed.`,
  };
}

export function isFillAllowed(level: FillPolicyLevel): boolean {
  return level === 'allowed';
}

export function isAssistedOnly(level: FillPolicyLevel): boolean {
  return level === 'assisted_only';
}
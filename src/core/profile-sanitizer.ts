import { MasterProfile } from '../types/master-profile.js';

/**
 * Removes sensitive keys or environment secrets before exporting or serving profile data.
 */
export function sanitizeProfileForExport(profile: MasterProfile): MasterProfile {
  const serialized = JSON.stringify(profile);
  const parsed = JSON.parse(serialized);

  // Deep recursive removal of any key matching apiKey, secret, token, password, authorization
  const secretKeyRegex = /(api[_-]?key|secret|private[_-]?key|token|auth[_-]?header|password)/i;

  function prune(node: any): any {
    if (Array.isArray(node)) {
      return node.map(prune);
    } else if (node !== null && typeof node === 'object') {
      const sanitizedObj: Record<string, any> = {};
      for (const [key, val] of Object.entries(node)) {
        if (!secretKeyRegex.test(key)) {
          sanitizedObj[key] = prune(val);
        }
      }
      return sanitizedObj;
    }
    return node;
  }

  return prune(parsed) as MasterProfile;
}

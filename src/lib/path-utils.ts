// src/lib/path-utils.ts

/**
 * Helper function to sanitize text for use in a path component.
 * This version is strictly aligned with the client-side safeSanitize.
 * @param text The text to sanitize.
 * @returns The sanitized text.
 */
export function sanitizeForPath(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  
  // Clean string: lowercase, replace spaces/hyphens with underscore, remove non-alphanumeric
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_') // Replace spaces and hyphens with a single underscore
    .replace(/[^a-z0-9_]/g, '') // Remove everything except letters, numbers, and underscores
    .replace(/_+/g, '_'); // Collapse multiple underscores
}

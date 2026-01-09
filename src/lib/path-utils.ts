// src/lib/path-utils.ts
import * as path from 'path';

/**
 * Helper function to sanitize text for use in a path component.
 * Replaces spaces with underscores, removes non-alphanumeric characters (except underscore, hyphen, and period).
 * @param text The text to sanitize.
 * @returns The sanitized text.
 */
export function sanitizeForPath(text: string): string {
  if (typeof text !== 'string') {
    return ''; // Return empty string if input is not a string
  }
  
  // Get the extension if it exists
  const ext = path.extname(text);
  // Get the base name without extension
  const baseName = path.basename(text, ext);

  // Sanitize the base name
  const sanitizedBaseName = baseName
    .toLowerCase()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-z0-9_-]/g, ''); // Remove non-alphanumeric (except _, -)

  // Re-append the original extension (lowercased)
  return sanitizedBaseName + ext.toLowerCase();
}

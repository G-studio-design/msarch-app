// src/config/api-config.ts

// Since we are not implementing smart routing, this file can be simplified
// to always return a relative path. The browser will handle using the
// correct domain (local IP or public domain) automatically.
// The server-side rendering (SSR) part is removed as it's not needed for this setup.

const getApiBaseUrl = (): string => {
  // Using a relative path is the simplest and most robust solution.
  // It works for both local access (http://<nas-ip>:4000) and
  // remote access (https://<your-domain>.com).
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

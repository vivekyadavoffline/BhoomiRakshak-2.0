/**
 * Centralized API Configuration and URL Normalizer for Bhoomi Rakshak
 * Ensures safe fallbacks and handles production deployment URLs cleanly.
 */

const rawEnvUrl = (import.meta.env.VITE_API_URL || '').trim();

// Clean URL: remove whitespace, trailing slashes, and trailing /api
export const cleanBaseUrl = (url) => {
  if (!url) return '';
  return url.replace(/\/+$/, '').replace(/\/api$/, '');
};

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// In production (e.g. Vercel/Netlify), if VITE_API_URL is unset, do NOT default to localhost:8000
// because it triggers browser Mixed Content blocks and connection refused errors.
export const API_BASE_URL = rawEnvUrl 
  ? cleanBaseUrl(rawEnvUrl) 
  : (isLocalhost ? 'http://localhost:8000' : '');

export const API_URL = API_BASE_URL ? `${API_BASE_URL}/api` : '/api';

/**
 * Builds a clean endpoint URL safely
 * @param {string} path - e.g. "/api/emails" or "/api/chat"
 */
export const buildApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return cleanPath;
  }
  return `${API_BASE_URL}${cleanPath}`;
};

import axios from "axios";
import { getToken } from "./auth";

// Export the base URL for direct access - use environment variable or fallback
// Prefer local development host by default. If you want to use the hosted backend,
// set REACT_APP_API_URL in your environment (.env or deployment settings).
// Example hosted URL (commented out):
// const HOSTED_BACKEND = 'https://bulsupms.com';

export const API_BASE_URL = process.env.REACT_APP_API_URL?.replace(/\/api\/?$/, '') || "http://localhost:8000";
  
// Create axios instance with base API URL and enable credentials for CSRF
const api = axios.create({
  // Use the normalized API origin and add the '/api' prefix so frontend paths like '/admin/...' become '/api/admin/...'
  baseURL: API_BASE_URL.replace(/\/$/, '') + '/api',
  withCredentials: true,
});

// Default request timeout (ms) to avoid silent hangs in the browser
api.defaults.timeout = 10000; // 10 seconds

// Expose the resolved base URL for easier debugging in the browser console
try {
  // eslint-disable-next-line no-console
  console.log('[api] resolved baseURL', api.defaults.baseURL);
} catch (e) {}

// Debug logging to verify API URL
// Debug logging removed for production/dev cleanliness. Set REACT_APP_API_URL to override the base URL.

// Attach token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Debug: log outgoing requests with method and url
    try {
      // eslint-disable-next-line no-console
      console.log('[api] request', { method: config.method, url: config.url, headers: config.headers });
      // attach start timestamp for duration measurement
      config.metadata = { startTime: new Date().getTime() };
    } catch (e) {
      // ignore logging errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response logging (also measure duration)
api.interceptors.response.use(
  (response) => {
    try {
      const duration = response.config?.metadata ? new Date().getTime() - response.config.metadata.startTime : null;
      // eslint-disable-next-line no-console
      console.log('[api] response', { url: response.config?.url, status: response.status, duration });
    } catch (e) {}
    return response;
  },
  (error) => {
    try {
      const cfg = error.config || {};
      const duration = cfg.metadata ? new Date().getTime() - cfg.metadata.startTime : null;
      // eslint-disable-next-line no-console
      console.error('[api] response error', { url: cfg.url, message: error.message, duration, code: error.code, status: error.response?.status });
      // Provide richer diagnostic details when available
      if (error.response) {
        // Response received from server (non-2xx)
        // eslint-disable-next-line no-console
        console.error('[api] response error details', {
          url: cfg.url,
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else if (error.request) {
        // Request was sent but no response received
        // eslint-disable-next-line no-console
        console.error('[api] no response received, request:', error.request);
      } else {
        // Something went wrong setting up the request
        // eslint-disable-next-line no-console
        console.error('[api] request setup error:', error.message);
      }
      try {
        // axios errors provide toJSON which can be helpful
        // eslint-disable-next-line no-console
        console.error('[api] error.toJSON()', error.toJSON ? error.toJSON() : null);
      } catch (inner) {}
    } catch (e) {}
    return Promise.reject(error);
  }
);

// Helper to initialize Sanctum CSRF cookie
export const initCsrf = async () => {
  // Use the normalized API origin (API_BASE_URL) and try common CSRF endpoints.
  const origin = API_BASE_URL;

  const candidates = [
    // common Laravel-sanctum locations (api-prefixed endpoints)
    `${origin}/api/csrf-cookie`,
    `${origin}/api/sanctum/csrf-cookie`,
    // non-api-prefixed endpoints
    `${origin}/sanctum/csrf-cookie`,
    // fallbacks for localhost/127.0.0.1 variants
    `${origin.replace('localhost', '127.0.0.1')}/api/csrf-cookie`,
    `${origin.replace('localhost', '127.0.0.1')}/sanctum/csrf-cookie`,
    `${origin.replace('127.0.0.1', 'localhost')}/api/csrf-cookie`,
    `${origin.replace('127.0.0.1', 'localhost')}/sanctum/csrf-cookie`,
    // relative fallbacks
    `/api/csrf-cookie`,
    `/sanctum/csrf-cookie`,
  ];

  let lastErr = null;
  for (const url of candidates) {
    try {
      const res = await axios.get(url, { withCredentials: true });
      // success
      return res;
    } catch (err) {
      lastErr = err;
      // Log debug info for the attempted URL — keep it concise but useful
  // CSRF probe failed for this candidate; moving to next candidate silently.
      // try next candidate
    }
  }

  // If we get here, all attempts failed — surface a helpful console error
  // All CSRF init candidates failed. Caller may handle this; suppressed noisy logging here.
  // Re-throw so callers can handle failure if they want
  throw lastErr;
};

// Make initCsrf available as a method on the api instance for convenience
api.initCsrf = initCsrf;

// Helper function to build image URLs using the API base URL
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  // If it's already a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Build the full URL using the normalized API origin
  const origin = API_BASE_URL;
  
  // Remove leading slash if present to avoid double slashes
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  
  return `${origin}/api/image/${cleanPath}`;
};

export default api;

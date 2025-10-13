import axios from "axios";
import { getToken } from "./auth";

// Export the base URL for direct access - use environment variable or fallback
export const API_BASE_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || "http://localhost:8000";

// Create axios instance with base API URL and enable credentials for CSRF
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000/api",
  withCredentials: true,
});

// Debug logging to verify API URL
console.log('🔗 Frontend API Configuration:', {
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  baseURL: api.defaults.baseURL,
  timestamp: new Date().toISOString()
});

// Attach token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper to initialize Sanctum CSRF cookie
export const initCsrf = async () => {
  // Try to derive the backend origin from the api instance baseURL.
  // If baseURL is like 'https://bulsupms.com/api' we want 'https://bulsupms.com'.
  const base = (api.defaults && api.defaults.baseURL) || process.env.REACT_APP_API_URL || "http://localhost:8000/api";
  const origin = base.replace(/\/api\/?$/, "");

  const candidates = [
    // common Laravel-sanctum locations (try api-prefixed first since this project registers it under /api)
    `${origin}/api/csrf-cookie`,
    `${origin}/api/sanctum/csrf-cookie`,
    // prefer configured origin
    `${origin}/sanctum/csrf-cookie`,
    // fallbacks (some dev setups use 127.0.0.1)
    `${origin.replace('localhost', '127.0.0.1')}/api/csrf-cookie`,
    `${origin.replace('localhost', '127.0.0.1')}/sanctum/csrf-cookie`,
    `${origin.replace('127.0.0.1', 'localhost')}/api/csrf-cookie`,
    `${origin.replace('127.0.0.1', 'localhost')}/sanctum/csrf-cookie`,
    // final fallback to relative paths
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
      console.debug(`CSRF init failed for ${url}:`, err.response?.status, err.message || err);
      // try next candidate
    }
  }

  // If we get here, all attempts failed — surface a helpful console error
  console.error('Failed to init CSRF cookie; tried candidates:', candidates, 'last error:', lastErr?.response?.status, lastErr?.message || lastErr);
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
  
  // Build the full URL using the API base URL
  const base = (api.defaults && api.defaults.baseURL) || process.env.REACT_APP_API_URL || "http://localhost:8000/api";
  const origin = base.replace(/\/api\/?$/, '');
  
  // Remove leading slash if present to avoid double slashes
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  
  return `${origin}/api/image/${cleanPath}`;
};

export default api;

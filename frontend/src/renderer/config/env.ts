// ============================================
// ENVIRONMENT CONFIG
// ============================================
// Auto-detect environment from hostname

// Auto-detect: localhost/127.0.0.1 = dev, otherwise = prod
const isDevelopment = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

// API Server URL
// - Development (auto-detected): 'http://localhost:8000'
// - Production (auto-detected): backend Cloud Run URL
export const API_URL = isDevelopment
  ? 'http://localhost:8000'
  : 'https://minute-backend.onrender.com'; // Placeholder, update when deployed

// Bật/tắt kết nối API (false = dùng mock data)
export const USE_API = true;

// Debug mode
export const DEBUG = isDevelopment;

// Supabase Auth (điền giá trị thật qua env Vite khi build)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

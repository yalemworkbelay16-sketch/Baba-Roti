/**
 * URL normalizer and document helpers for persistent cloud attachments (MongoDB GridFS).
 * Handles HTTPS mixed-content resolution, reverse-proxy domains, and PDF/image detection.
 */

/**
 * Resolves any upload or attachment URL into a safe, normalized URL.
 * Automatically resolves localhost/IP references, ensures HTTPS when app is on HTTPS,
 * and attaches correct backend API host when configured.
 *
 * @param {string} url - Raw URL or relative path (e.g. 'http://localhost:5000/api/upload/receipt-1.pdf')
 * @returns {string} - Normalized safe URL
 */
export function normalizeFileUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  // Already a base64 data URI or blob URL
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const isBrowser = typeof window !== 'undefined' && window.location;
  const isCloudHost = isBrowser && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  // Case 1: URL contains '/api/upload/' (e.g. http://localhost:5000/api/upload/receipt-1.pdf or /api/upload/...)
  const uploadIndex = trimmed.indexOf('/api/upload/');
  if (uploadIndex !== -1) {
    const uploadPath = trimmed.slice(uploadIndex); // '/api/upload/filename.ext'

    // On any cloud host (Aletcloud, Render, VPS, custom domain), ALWAYS return clean relative path
    // so current HTTPS domain without port 5000 is used!
    if (isCloudHost) {
      return uploadPath;
    }

    // On local dev with Vite on port 5173, point to backend port 5000
    if (isBrowser && window.location.hostname === 'localhost' && window.location.port !== '5000') {
      return `http://localhost:5000${uploadPath}`;
    }

    return uploadPath;
  }

  // Case 2: Raw filename only (e.g. 'receipt-1729000-12345.pdf')
  if (!trimmed.includes('/') && /^[a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]+$/.test(trimmed)) {
    const uploadPath = `/api/upload/${trimmed}`;
    if (isCloudHost) return uploadPath;
    if (isBrowser && window.location.hostname === 'localhost' && window.location.port !== '5000') {
      return `http://localhost:5000${uploadPath}`;
    }
    return uploadPath;
  }

  // Case 3: Absolute URL on http: while active window is https: (mixed content prevention)
  if (
    isBrowser &&
    window.location.protocol === 'https:' &&
    trimmed.startsWith('http://')
  ) {
    // If it points to localhost or private IP or port 5000, relative route is safer
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1') || trimmed.includes(':5000')) {
      const match = trimmed.match(/\/api\/upload\/[^\s?#]+/);
      if (match) return match[0];
      return trimmed.replace(/^http:\/\/[^/]+/, '');
    }
    // Otherwise upgrade http:// to https://
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  return trimmed;
}

/**
 * Checks whether an attachment or URL is a PDF document.
 * @param {string} url
 * @param {string} [mimeType]
 * @returns {boolean}
 */
export function isPdfDocument(url = '', mimeType = '') {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().includes('pdf')) {
    return true;
  }
  if (!url || typeof url !== 'string') return false;
  const cleanPath = url.split('?')[0].split('#')[0].toLowerCase();
  return cleanPath.endsWith('.pdf');
}

/**
 * Checks whether an attachment or URL is an image.
 * @param {string} url
 * @param {string} [mimeType]
 * @returns {boolean}
 */
export function isImageDocument(url = '', mimeType = '') {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('image/')) {
    return true;
  }
  if (!url || typeof url !== 'string') return false;
  const cleanPath = url.split('?')[0].split('#')[0].toLowerCase();
  return /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(cleanPath);
}

/**
 * Formats file size in bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Extracts a clean readable file name from a URL or attachment object.
 * @param {string} url
 * @param {string} [fallback]
 * @returns {string}
 */
export function getFileNameFromUrl(url = '', fallback = 'Document') {
  if (!url || typeof url !== 'string') return fallback;
  try {
    const clean = url.split('?')[0].split('#')[0];
    const parts = clean.split('/');
    const last = parts[parts.length - 1];
    return decodeURIComponent(last) || fallback;
  } catch {
    return fallback;
  }
}


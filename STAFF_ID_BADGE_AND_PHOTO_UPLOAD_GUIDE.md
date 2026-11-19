# Staff ID Badge & 3×4 Photo Upload System — Reusable Implementation Guide

This document contains the complete frontend and backend code, schema definitions, URL normalizer, and iframe print engine implemented in Baba Roti. You can give this file directly to any developer, teammate, or code editor (VS Code, Cursor, etc.) to replicate this feature in other projects.

---

## 📦 Required Dependencies

### Frontend (`client/package.json`):
```bash
npm install qrcode lucide-react
```

### Backend (`server/package.json`):
```bash
npm install mongoose multer express-async-handler
```

---

## 1. Backend Schemas (Mongoose)

Add `photoUrl` to your models:

```javascript
// models/Employee.js
const employeeSchema = new mongoose.Schema(
  {
    employeeId:  { type: String, trim: true, default: '' },
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    department:  { type: String, trim: true, default: 'Other' },
    position:    { type: String, trim: true, default: '' },
    phone:       { type: String, trim: true, default: '' },
    email:       { type: String, trim: true, lowercase: true, default: '' },
    hireDate:    { type: Date,   default: null },
    status:      { type: String, enum: ['active', 'inactive', 'on_leave'], default: 'active' },
    notes:       { type: String, trim: true, default: '' },
    photoUrl:    { type: String, trim: true, default: '' }, // 3x4 passport photo
    deletedAt:   { type: Date,   default: null },
  },
  { timestamps: true }
);

// models/User.js (Staff Accounts)
const userSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true },
    password:    { type: String, required: true },
    role:        { type: String, default: 'staff' },
    phone:       { type: String, trim: true, default: '' },
    avatar:      { type: String, default: '' },
    photoUrl:    { type: String, trim: true, default: '' },
    employeeId:  { type: String, trim: true, default: '' },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);
```

---

## 2. Safe Cloud URL Normalizer (`utils/fileUrl.js`)

Solves the common bug where cloud containers append `http://localhost:5000` or closed ports, causing mixed-content and connection timeout errors:

```javascript
export function normalizeFileUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const isBrowser = typeof window !== 'undefined' && window.location;
  const isCloudHost = isBrowser && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  // 1. Any path containing '/api/upload/'
  const uploadIndex = trimmed.indexOf('/api/upload/');
  if (uploadIndex !== -1) {
    const uploadPath = trimmed.slice(uploadIndex);
    if (isCloudHost) return uploadPath; // Uses active browser domain + HTTPS
    if (isBrowser && window.location.hostname === 'localhost' && window.location.port !== '5000') {
      return `http://localhost:5000${uploadPath}`;
    }
    return uploadPath;
  }

  // 2. Raw filename only
  if (!trimmed.includes('/') && /^[a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]+$/.test(trimmed)) {
    const uploadPath = `/api/upload/${trimmed}`;
    if (isCloudHost) return uploadPath;
    if (isBrowser && window.location.hostname === 'localhost' && window.location.port !== '5000') {
      return `http://localhost:5000${uploadPath}`;
    }
    return uploadPath;
  }

  // 3. Upgrade http: to https: when site is on https:
  if (isBrowser && window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1') || trimmed.includes(':5000')) {
      const match = trimmed.match(/\/api\/upload\/[^\s?#]+/);
      if (match) return match[0];
      return trimmed.replace(/^http:\/\/[^/]+/, '');
    }
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  return trimmed;
}
```

---

## 3. 3×4 Photo Upload Widget (React + Tailwind)

```jsx
import React, { useRef, useState } from 'react';
import { Camera, Upload, Check, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { normalizeFileUrl } from '../utils/fileUrl';

export default function PhotoUpload3x4({ photoUrl, onPhotoChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be under 10MB.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('files', file);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedUrl = res.data?.files?.[0]?.url;
      if (uploadedUrl) {
        onPhotoChange(uploadedUrl);
      } else {
        setError('Upload failed. No file URL returned.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
        <span>
          <Camera size={11} className="inline mr-1 text-blue-600" />
          3×4 Passport Photo
        </span>
        {photoUrl && (
          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
            <Check size={10} /> Ready
          </span>
        )}
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={handleUpload}
      />

      {photoUrl ? (
        <div className="flex items-center gap-2.5 p-2 rounded-xl border border-blue-200 bg-blue-50/40">
          <div
            className="relative rounded-lg overflow-hidden border border-blue-300 shadow-xs bg-white shrink-0"
            style={{ width: '45px', height: '60px' }} // Exact 3:4 aspect ratio
          >
            <img
              src={normalizeFileUrl(photoUrl)}
              alt="3x4 Preview"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
              3×4 Photo
            </span>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">Linked to ID Badge</p>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Change
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => onPhotoChange('')}
                disabled={uploading}
                className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`w-full rounded-xl border-2 border-dashed px-3 py-2 text-center cursor-pointer transition flex items-center justify-center gap-2.5 ${
            uploading
              ? 'border-blue-400 bg-blue-50/60 cursor-wait'
              : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 bg-slate-50/50'
          }`}
          style={{ minHeight: '60px' }}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
              <RefreshCw size={14} className="animate-spin" />
              <span>Uploading 3×4 photo…</span>
            </div>
          ) : (
            <>
              <div className="h-8 w-6 rounded border border-slate-300 bg-white shadow-2xs flex items-center justify-center text-slate-400 shrink-0">
                <Camera size={13} className="text-blue-600" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700 leading-tight">
                  Upload 3×4 Photo
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Passport size (JPG, PNG) for Staff ID Pass
                </div>
              </div>
              <Upload size={13} className="text-slate-400 shrink-0" />
            </>
          )}
        </div>
      )}

      {error && <p className="text-[10px] text-red-600 mt-1">⚠ {error}</p>}
    </div>
  );
}
```

---

## 4. Digital Staff ID Badge & Iframe Print Engine

Copy [EmployeeIdBadgeModal.jsx](file:///a:/Baba%20Roti-stock-system/client/src/components/employee/EmployeeIdBadgeModal.jsx) into your components folder.

### Key features included in this component:
1. **Lanyard Slot & Casing Design**: Physical card simulation with clip hole.
2. **Top Diagonal Stripes & Branding**: Executive brand identity styling.
3. **Centered 3:4 Passport Portrait**: High-contrast with status dot and fallback initials.
4. **Bilingual Typography**: Formatted with both English and Amharic labels (`ስም / Name`, `የሥራ መደብ / Position`, `መለያ ቁጥር / ID No`).
5. **QR Code Verification**: Generated automatically with `QRCode.toDataURL`.
6. **Isolated Iframe Printer (`handlePrint`)**: Never produces blank pages, forces colors with `-webkit-print-color-adjust: exact`, and supports printing **Both Sides (Front & Back)** side-by-side with scissors cutting guide!

---

## 5. Integrating with Tables & Forms

### Adding the ID Badge Button to Table Rows:
```jsx
<button
  type="button"
  onClick={() => {
    setBadgeEmployee(emp);
    setBadgeModalOpen(true);
  }}
  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 text-xs font-semibold text-white transition shadow-2xs"
  title="View & Print Staff ID Badge"
>
  <Award size={12} /> ID Badge
</button>
```

### Auto-Opening Badge Upon Creating Employee:
```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  const res = await api.post('/employees', form);
  setModalOpen(false);
  load();

  // Present ID Badge immediately
  if (res.data) {
    setBadgeEmployee(res.data);
    setIsNewlyCreated(true);
    setBadgeModalOpen(true);
  }
};
```

import React, { useRef, useState } from 'react';
import {
  Paperclip,
  UploadCloud,
  X,
  FileText,
  Loader2,
  Eye,
  Trash2,
  Camera,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import api from '../../api/axios';
import {
  normalizeFileUrl,
  isPdfDocument,
  isImageDocument,
  formatFileSize,
  getFileNameFromUrl,
} from '../../utils/fileUrl';

/**
 * Enhanced Attachment Uploader with MongoDB Atlas GridFS cloud persistence support.
 * Supports JPG, PNG, WEBP, PDF with automatic URL normalization, PDF preview cards,
 * and 1-click re-upload for wiped session images.
 */
export default function AttachmentUploader({
  attachments = [],
  onAttachmentsChange,
  disabled = false,
}) {
  const inputRef        = useRef(null);
  const cameraRef       = useRef(null);
  const replaceInputRef = useRef(null);

  const [uploading, setUploading]               = useState(false);
  const [reuploadingIdx, setReuploadingIdx]     = useState(null);
  const [dragOver, setDragOver]                 = useState(false);
  const [previewUrl, setPreviewUrl]             = useState(null);
  const [failedImages, setFailedImages]         = useState({});

  // ── Upload new files (append) ──────────────────────────────────────────
  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.files) {
        onAttachmentsChange([...attachments, ...res.data.files]);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  // ── 1-Click Re-upload for a broken / wiped attachment ──────────────────
  const triggerReupload = (idx) => {
    setReuploadingIdx(idx);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  const handleReplacementFile = async (e) => {
    const file = e.target.files?.[0];
    const targetIdx = reuploadingIdx;
    if (!file || targetIdx === null) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.files?.[0]) {
        const newFile = res.data.files[0];
        const updated = [...attachments];
        updated[targetIdx] = newFile;
        onAttachmentsChange(updated);

        // Clear error state for this index
        setFailedImages((prev) => {
          const next = { ...prev };
          delete next[targetIdx];
          return next;
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Re-upload failed. Please try again.');
    } finally {
      setUploading(false);
      setReuploadingIdx(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const handleFileChange   = (e) => uploadFiles(e.target.files);
  const handleCameraChange = (e) => uploadFiles(e.target.files);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const removeAttachment = (idx) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== idx));
    setFailedImages((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
          px-4 py-5 text-center transition select-none
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-ink-200 bg-ink-50/60 hover:border-blue-400 hover:bg-blue-50/30'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {uploading ? (
          <>
            <Loader2 size={22} className="animate-spin text-blue-500" />
            <p className="text-xs text-blue-700 font-medium">
              {reuploadingIdx !== null ? 'Re-uploading document to cloud storage…' : 'Uploading to MongoDB Atlas…'}
            </p>
          </>
        ) : (
          <>
            <UploadCloud size={22} className="text-ink-400" />
            <div>
              <p className="text-xs font-semibold text-ink-700">Upload Receipt / Invoice / Document</p>
              <p className="text-[11px] text-ink-400 mt-0.5">
                JPG, PNG, WEBP, PDF up to 10 MB · Persistent MongoDB Atlas Storage
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => !disabled && !uploading && inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <Paperclip size={12} /> Attach File
              </button>

              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => !disabled && !uploading && cameraRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                title="Take a photo with your device camera"
              >
                <Camera size={12} /> Take Photo
              </button>
            </div>
          </>
        )}

        {/* Hidden standard file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />

        {/* Hidden camera input */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraChange}
          disabled={disabled || uploading}
        />

        {/* Hidden replacement file input for 1-click re-upload */}
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleReplacementFile}
        />
      </div>

      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att, idx) => {
            const rawUrl    = att.url || '';
            const safeUrl   = normalizeFileUrl(rawUrl);
            const isPdf     = isPdfDocument(rawUrl, att.mimeType);
            const isImg     = isImageDocument(rawUrl, att.mimeType);
            const fileName  = att.name || getFileNameFromUrl(rawUrl, `Attachment-${idx + 1}`);
            const isBroken  = failedImages[idx];

            return (
              <div
                key={idx}
                className="flex items-center gap-2.5 rounded-xl border border-ink-100 bg-white p-2.5 shadow-xs text-xs"
              >
                {/* PDF Document View */}
                {isPdf ? (
                  <div className="h-10 w-10 rounded-lg bg-red-50 border border-red-200 flex flex-col items-center justify-center shrink-0 text-red-600">
                    <FileText size={18} />
                    <span className="text-[9px] font-bold uppercase tracking-tight">PDF</span>
                  </div>
                ) : isBroken ? (
                  /* Failed image notice badge */
                  <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600" title="File not found in storage">
                    <AlertTriangle size={18} />
                  </div>
                ) : isImg ? (
                  /* Image thumbnail with onError handler */
                  <img
                    src={safeUrl}
                    alt={fileName}
                    className="h-10 w-10 rounded-lg object-cover border border-ink-100 shrink-0 cursor-pointer hover:opacity-90 transition"
                    onClick={() => setPreviewUrl(safeUrl)}
                    onError={() => setFailedImages((prev) => ({ ...prev, [idx]: true }))}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-ink-50 border border-ink-200 flex items-center justify-center shrink-0 text-ink-500">
                    <FileText size={18} />
                  </div>
                )}

                {/* Details / Notice */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-ink-800 truncate">{fileName}</p>
                    {isPdf && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 shrink-0">
                        PDF
                      </span>
                    )}
                  </div>

                  {isBroken ? (
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[11px] text-amber-700 font-medium">
                        File wiped from prior session
                      </span>
                      <button
                        type="button"
                        onClick={() => triggerReupload(idx)}
                        disabled={disabled || uploading}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 underline hover:text-amber-900"
                      >
                        <RefreshCw size={11} /> Re-upload now
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-400 mt-0.5">
                      {att.size > 0 ? formatFileSize(att.size) : 'Stored in MongoDB'}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* View PDF button */}
                  {isPdf && safeUrl && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2 py-1 font-semibold text-[11px] transition"
                    >
                      <FileText size={12} /> View PDF <ExternalLink size={10} />
                    </a>
                  )}

                  {/* Preview image button */}
                  {isImg && !isBroken && safeUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(safeUrl)}
                      className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
                      title="Preview full image"
                    >
                      <Eye size={14} />
                    </button>
                  )}

                  {/* 1-Click Re-upload button */}
                  {isBroken && (
                    <button
                      type="button"
                      onClick={() => triggerReupload(idx)}
                      disabled={disabled || uploading}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 font-semibold text-[11px] transition shadow-xs"
                      title="Upload a fresh copy of this document"
                    >
                      <UploadCloud size={12} /> Re-upload
                    </button>
                  )}

                  {/* Remove attachment */}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      title="Remove attachment"
                      className="p-1.5 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-ink-800 flex items-center justify-center shadow-lg hover:bg-ink-100 z-10"
              title="Close"
            >
              <X size={16} />
            </button>
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── AttachmentViewer (read-only list shown in detail modals) ───────────
export function AttachmentViewer({ attachments = [], onReupload = null }) {
  const [previewUrl, setPreviewUrl]     = useState(null);
  const [failedImages, setFailedImages] = useState({});

  if (!attachments || attachments.length === 0) {
    return <p className="text-xs text-ink-400 italic">No attachments.</p>;
  }

  return (
    <>
      <div className="space-y-1.5">
        {attachments.map((att, idx) => {
          const rawUrl   = att.url || '';
          const safeUrl  = normalizeFileUrl(rawUrl);
          const isPdf    = isPdfDocument(rawUrl, att.mimeType);
          const isImg    = isImageDocument(rawUrl, att.mimeType);
          const fileName = att.name || getFileNameFromUrl(rawUrl, `Attachment-${idx + 1}`);
          const isBroken = failedImages[idx];

          return (
            <div
              key={idx}
              className="flex items-center gap-2.5 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs"
            >
              {/* PDF Icon or Image Thumbnail */}
              {isPdf ? (
                <div className="h-9 w-9 rounded-md bg-red-100 border border-red-200 flex flex-col items-center justify-center shrink-0 text-red-600">
                  <FileText size={16} />
                  <span className="text-[8px] font-bold">PDF</span>
                </div>
              ) : isBroken ? (
                <div className="h-9 w-9 rounded-md bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700">
                  <AlertTriangle size={16} />
                </div>
              ) : isImg ? (
                <img
                  src={safeUrl}
                  alt={fileName}
                  className="h-9 w-9 rounded-md object-cover border border-ink-100 shrink-0 cursor-pointer hover:opacity-85 transition"
                  onClick={() => setPreviewUrl(safeUrl)}
                  onError={() => setFailedImages((prev) => ({ ...prev, [idx]: true }))}
                />
              ) : (
                <span className="h-9 w-9 rounded-md bg-ink-100 border border-ink-200 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-ink-600" />
                </span>
              )}

              {/* Title & Size */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-800 truncate">{fileName}</p>
                {isBroken ? (
                  <p className="text-[11px] text-amber-700">File unavailable (cleared on server restart)</p>
                ) : att.size > 0 ? (
                  <p className="text-ink-400">{formatFileSize(att.size)}</p>
                ) : (
                  <p className="text-ink-400">Atlas Cloud Stored</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {isPdf ? (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-700 text-white px-2 py-1 font-semibold text-[11px] transition shadow-xs"
                  >
                    <FileText size={11} /> View PDF <ExternalLink size={10} />
                  </a>
                ) : isBroken && onReupload ? (
                  <button
                    type="button"
                    onClick={() => onReupload(idx, att)}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 font-semibold text-[11px] transition shadow-xs"
                  >
                    <RefreshCw size={11} /> Re-upload
                  </button>
                ) : (
                  safeUrl && !isBroken && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-ink-400 hover:bg-ink-200/60 hover:text-blue-600 transition"
                      title="Open in new tab"
                    >
                      <Eye size={13} />
                    </a>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-ink-800 flex items-center justify-center shadow-lg hover:bg-ink-100 z-10"
              title="Close"
            >
              <X size={16} />
            </button>
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

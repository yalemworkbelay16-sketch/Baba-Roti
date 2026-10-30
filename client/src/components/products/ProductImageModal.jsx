import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Upload, Trash2, CheckCircle2, AlertCircle, Loader2, Camera, RefreshCw, Image as ImageIcon } from 'lucide-react';
import Modal from '../ui/Modal';
import api from '../../api/axios';

const ProductImageModal = ({ open, onClose, product, onImageUpdated }) => {
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' | 'upload'
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  // Initialize prompt when product changes
  useEffect(() => {
    if (product) {
      setError('');
      setStatusMessage('');
      setPreviewFile(null);
      setPreviewUrl('');
      // Suggest a nice default prompt
      const cat = product.category || 'Food & Beverage';
      setCustomPrompt(`Appetizing professional restaurant food photography of freshly prepared ${product.name} (${cat}), beautifully plated on a rustic dining table, warm ambient café lighting, commercial culinary photo`);
    }
  }, [product]);

  if (!product) return null;

  // ── Handle AI Image Generation ──
  const handleGenerateAi = async () => {
    try {
      setLoading(true);
      setError('');
      setStatusMessage('✨ AI is detecting dish styling and generating photo...');

      const res = await api.post(`/products/${product._id}/ai-image`, {
        prompt: customPrompt.trim(),
      });

      if (res.data && res.data.success) {
        setStatusMessage('✅ Saved permanently to MongoDB Atlas GridFS!');
        if (onImageUpdated) {
          onImageUpdated(res.data.product || { ...product, imageUrl: res.data.imageUrl });
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('AI Image generation error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to generate AI image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Manual Upload from Computer ──
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file must be under 10MB.');
      return;
    }

    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const handleUploadManual = async () => {
    if (!previewFile) {
      setError('Please select an image file first.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStatusMessage('Uploading to MongoDB Atlas GridFS cloud storage...');

      const formData = new FormData();
      formData.append('image', previewFile);

      const res = await api.post(`/products/${product._id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data && res.data.success) {
        setStatusMessage('✅ Image uploaded successfully!');
        if (onImageUpdated) {
          onImageUpdated(res.data.product || { ...product, imageUrl: res.data.imageUrl });
        }
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to upload image.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Remove Image ──
  const handleRemoveImage = async () => {
    if (!confirm(`Remove the image for "${product.name}"?`)) return;

    try {
      setLoading(true);
      setError('');
      await api.delete(`/products/${product._id}/image`);
      if (onImageUpdated) {
        onImageUpdated({ ...product, imageUrl: '' });
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove image.');
    } finally {
      setLoading(false);
    }
  };

  const currentImageUrl = previewUrl || product.imageUrl;

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={`Product Image — ${product.name}`}
      width="max-w-xl"
    >
      <div className="space-y-4">
        {/* Product Summary Header */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 p-3">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
              {currentImageUrl ? (
                <img
                  src={currentImageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                  }}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-slate-300">
                  <Camera size={22} />
                  <span className="text-[9px] font-medium text-slate-400 mt-0.5">No Image</span>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-slate-400">{product.code || 'P-ITEM'}</span>
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {product.category || 'FOOD'}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm">{product.name}</h4>
              <p className="text-xs text-slate-500">ETB {Number(product.sellingPrice || 0).toFixed(2)}</p>
            </div>
          </div>

          {product.imageUrl && (
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1.5 rounded-lg border border-transparent hover:border-rose-200 transition"
              title="Remove current image"
            >
              <Trash2 size={13} />
              Remove
            </button>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'ai' ? 'text-amber-200' : 'text-indigo-500'} />
            ✨ AI Food Image Generator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload size={14} className="text-blue-600" />
            📁 Upload from Computer
          </button>
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-800">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: AI GENERATION */}
        {activeTab === 'ai' && (
          <div className="space-y-3 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/40 p-4">
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  AI Dish Detection & Photo Synthesis
                </h5>
                <p className="text-xs text-slate-600 mt-0.5">
                  The AI analyzes the food title <span className="font-bold text-indigo-700">"{product.name}"</span> and culinary category to render a photorealistic commercial restaurant photograph, stored permanently in MongoDB Atlas.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Culinary Image Prompt (Auto-detected, customizable)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                placeholder="Describe how the dish should look..."
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  const cat = product.category || 'FOOD';
                  setCustomPrompt(`Appetizing professional restaurant food photography of freshly prepared ${product.name} (${cat}), beautifully plated on a rustic dining table, warm ambient café lighting, commercial culinary photo`);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
              >
                <RefreshCw size={12} /> Reset to Default
              </button>

              <button
                type="button"
                onClick={handleGenerateAi}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-blue-700 hover:to-purple-700 active:scale-[0.98] transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" />
                    <span>Synthesizing Photo with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="text-amber-300 animate-pulse" />
                    <span>Generate & Save Image</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MANUAL UPLOAD */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/30 p-6 text-center cursor-pointer transition"
            >
              {previewUrl ? (
                <div className="space-y-2">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-28 w-28 rounded-lg object-cover mx-auto border border-slate-300 shadow-sm"
                  />
                  <p className="text-xs font-bold text-slate-800">{previewFile?.name}</p>
                  <p className="text-[11px] text-blue-600 underline">Click to choose a different file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                    <Upload size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Click to choose an image from your computer
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Supports JPG, PNG, WEBP (Max 10MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadManual}
                disabled={loading || !previewFile}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-white" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={13} />
                    <span>Save to Cloud</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Storage Persistence Notice */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Permanent MongoDB Atlas GridFS storage
          </span>
          <span>100% cloud persistent</span>
        </div>
      </div>
    </Modal>
  );
};

export default ProductImageModal;

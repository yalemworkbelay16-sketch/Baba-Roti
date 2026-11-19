import React, { useState, useEffect, useRef } from 'react';
import {
  X, Printer, RotateCw, CheckCircle2, ShieldCheck, Building2,
  Phone, Mail, Award, Sparkles, User, Camera, Upload, QrCode as QrIcon
} from 'lucide-react';
import QRCode from 'qrcode';
import { BabaRotiIcon } from '../ui/BabaRotiLogo';
import { normalizeFileUrl } from '../../utils/fileUrl';

/**
 * Corporate Digital Staff ID Badge Modal
 * Modeled after executive Ethiopian corporate identity passes (Bunna Bank / Hilton standard).
 * Features 3x4 passport portrait, bilingual English/Amharic headers, diagonal accent stripes,
 * scannable QR verification, lanyard punch-hole, and CR80 print isolation.
 */
export default function EmployeeIdBadgeModal({
  open,
  onClose,
  employee,
  onEdit,
  isNewlyCreated = false,
}) {
  const [side, setSide] = useState('front'); // 'front' | 'back'
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const badgeRef = useRef(null);

  const rolePositions = {
    admin: 'System Administrator',
    manager: 'General Manager',
    supervisor: 'Supervisor',
    storekeeper: 'Store Keeper',
    cashier: 'Cashier',
    waiter: 'Waiter',
    dev: 'System Developer',
  };

  const roleDepartments = {
    admin: 'Management',
    manager: 'Management',
    supervisor: 'Food & Beverage',
    storekeeper: 'Store & Inventory',
    cashier: 'Finance & Cashier',
    waiter: 'Dining & Service',
    dev: 'IT & Systems',
  };

  const fullName = employee
    ? (employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`).trim()
    : 'Mequannent Gashaw';

  const employeeId = employee?.employeeId
    ? employee.employeeId
    : employee?._id
    ? `EMP-${String(employee._id).slice(-4).toUpperCase()}`
    : 'EMP-0018';

  const position = employee?.position
    || (employee?.role ? rolePositions[employee.role] || employee.role : 'IT Support');

  const department = employee?.department
    || (employee?.role ? roleDepartments[employee.role] || 'Waiter' : 'Waiter');

  const hireDate = employee?.hireDate
    ? new Date(employee.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : employee?.createdAt
    ? new Date(employee.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Nov 19, 2026';

  const rawPhoto = employee?.photoUrl || employee?.avatar || '';
  const photoSrc = rawPhoto ? normalizeFileUrl(rawPhoto) : '';

  const isCardActive = employee?.isActive !== undefined ? employee.isActive : (employee?.status !== 'inactive');

  // Compute initials
  const initials = (() => {
    if (employee?.firstName) {
      return `${employee.firstName[0]}${employee.lastName?.[0] || ''}`.toUpperCase();
    }
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      return parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    }
    return 'MG';
  })();

  // Generate QR Code data URL
  useEffect(() => {
    if (!employee) return;
    const qrPayload = JSON.stringify({
      id: employeeId,
      name: fullName,
      dept: department,
      role: position,
      org: 'Baba Roti Café',
      verify: 'OFFICIAL_STAFF_PASS',
    });

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('QR code generation failed:', err));
  }, [employee, fullName, employeeId, department, position]);

  // Reset photo load error when photo source changes
  useEffect(() => {
    setPhotoLoadError(false);
  }, [photoSrc]);

  if (!open || !employee) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      
      {/* Print Specific CSS to isolate Badge during window.print() */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-employee-badge-area,
          #printable-employee-badge-area * {
            visibility: visible !important;
          }
          #printable-employee-badge-area {
            position: absolute !important;
            left: 50% !important;
            top: 30px !important;
            transform: translateX(-50%) !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            page-break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:w-auto">

        {/* Modal Header */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#450f0f] via-[#5c1616] to-[#7f1d1d] text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
              <Award className="h-4 w-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Official Staff Identity Badge
                {isNewlyCreated && (
                  <span className="text-[10px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    ✨ Registered!
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-amber-200/80">Corporate Staff Pass · Baba Roti</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSide(s => s === 'front' ? 'back' : 'front')}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-100 transition"
              title="Flip between Front and Back of badge"
            >
              <RotateCw size={13} />
              <span>{side === 'front' ? 'Show Back' : 'Show Front'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-amber-100/70 hover:text-white hover:bg-white/10 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body / Badge Container */}
        <div className="p-4 sm:p-6 bg-slate-100 flex flex-col items-center justify-center overflow-y-auto">

          {/* Success toast when newly registered */}
          {isNewlyCreated && (
            <div className="no-print w-full max-w-sm mb-3 text-center bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>Staff profile created! Official ID Badge is ready to print.</span>
            </div>
          )}

          {/* ══════════════ PHYSICAL BADGE CASING (with lanyard clip) ══════════════ */}
          <div className="relative flex flex-col items-center">
            
            {/* Lanyard Strap & Metallic Swivel Hook (as seen in user reference photo) */}
            <div className="no-print flex flex-col items-center -mb-2 z-20">
              <div className="w-8 h-10 bg-gradient-to-b from-[#6b1e1e] to-[#450f0f] rounded-t-sm shadow-md border-x border-[#3b0f0f] flex items-center justify-center">
                <div className="w-1.5 h-6 bg-amber-400/30 rounded-full" />
              </div>
              <div className="w-6 h-5 rounded-t-full border-2 border-slate-400 bg-gradient-to-b from-slate-200 to-slate-400 shadow-sm flex items-center justify-center -mt-1">
                <div className="w-3 h-3 rounded-full bg-slate-500 shadow-inner" />
              </div>
            </div>

            {/* Clear Protective ID Card Casing Holder */}
            <div
              id="printable-employee-badge-area"
              ref={badgeRef}
              className="w-[310px] sm:w-[330px] rounded-2xl bg-white shadow-2xl border-4 border-slate-200/90 overflow-hidden flex flex-col relative select-none"
              style={{
                minHeight: '500px',
              }}
            >
              {/* Lanyard Slot Hole at top of clear plastic holder */}
              <div className="w-full flex justify-center pt-2 pb-1.5 bg-slate-50 border-b border-slate-200/60 relative z-10">
                <div className="w-14 h-3 rounded-full bg-slate-200 border border-slate-300 shadow-inner flex items-center justify-center">
                  <div className="w-10 h-1 rounded-full bg-slate-300" />
                </div>
              </div>

              {side === 'front' ? (
                /* ═══════════════ FRONT OF BADGE ═══════════════ */
                <div className="flex-1 flex flex-col bg-white relative">
                  
                  {/* Top Header Row: Company Logo + Diagonal Corporate Stripes (Matches reference photo) */}
                  <div className="px-4 pt-3 pb-2 flex items-start justify-between relative overflow-hidden">
                    
                    {/* Left: Baba Roti Logo and Corporate Branding */}
                    <div className="flex items-center gap-2 z-10">
                      <BabaRotiIcon size={36} className="ring-2 ring-amber-400/90 shadow-md" />
                      <div>
                        <span className="block text-xs font-black tracking-tight text-slate-900 leading-tight uppercase font-sans">
                          BABA ROTI
                        </span>
                        <span className="block text-[9px] font-bold tracking-wider text-amber-700 uppercase">
                          CAFÉ & RESTAURANT
                        </span>
                      </div>
                    </div>

                    {/* Right: Modern Corporate Diagonal Accent Stripes (exact look as user reference!) */}
                    <div className="relative w-20 h-10 overflow-hidden pointer-events-none">
                      {/* Diagonal stripe 1: Amber / Gold */}
                      <div
                        className="absolute right-0 top-1 w-16 h-1.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full shadow-xs"
                        style={{ transform: 'rotate(-25deg)', transformOrigin: 'top right' }}
                      />
                      {/* Diagonal stripe 2: Deep Burgundy */}
                      <div
                        className="absolute right-2 top-4 w-14 h-1.5 bg-gradient-to-r from-[#5c1616] to-[#881337] rounded-full shadow-xs"
                        style={{ transform: 'rotate(-25deg)', transformOrigin: 'top right' }}
                      />
                    </div>
                  </div>

                  {/* 3×4 Passport Photo Area (Center Prominent) */}
                  <div className="flex flex-col items-center pt-2 pb-1 relative z-10">
                    <div
                      className="relative rounded-lg overflow-hidden shadow-md border-2 border-slate-300 bg-slate-50 flex items-center justify-center group"
                      style={{
                        width: '126px',
                        height: '168px', // Exact 3:4 passport aspect ratio
                      }}
                    >
                      {photoSrc && !photoLoadError ? (
                        <img
                          src={photoSrc}
                          alt=""
                          className="w-full h-full object-cover object-top select-none"
                          onError={() => {
                            console.warn('[Badge] Failed to load photo:', photoSrc);
                            setPhotoLoadError(true);
                          }}
                        />
                      ) : (
                        /* Fallback when no photo uploaded or photo failed to load */
                        <div
                          className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 text-slate-400 p-2 text-center"
                        >
                          <div className="w-14 h-14 rounded-full bg-amber-100 text-[#5c1616] font-extrabold text-xl flex items-center justify-center border-2 border-amber-300 shadow-xs mb-1">
                            {initials}
                          </div>
                          <span className="text-[10px] font-bold text-slate-600">3×4 Photo</span>
                          <span className="text-[8px] text-slate-400">Passport View</span>
                          
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onEdit(employee);
                              }}
                              className="no-print mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:underline"
                            >
                              <Camera size={9} /> Upload Photo
                            </button>
                          )}
                        </div>
                      )}

                      {/* Active Status Badge Dot */}
                      <div
                        className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                          isCardActive ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        title={isCardActive ? 'Active Staff' : 'Disabled'}
                      />
                    </div>
                  </div>

                  {/* Employee Information Block (Clean Corporate Labeled Rows like Bunna Bank reference) */}
                  <div className="px-5 pt-3 pb-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5 text-xs text-slate-800">
                      
                      {/* Name Row (with Ethiopian Amharic + English bilingual label) */}
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 tracking-wider">
                          ስም / Name:
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 tracking-tight leading-tight uppercase font-sans">
                          {fullName}
                        </div>
                      </div>

                      {/* Position / Job Title Row */}
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 tracking-wider">
                          የሥራ መደብ / Position:
                        </div>
                        <div className="text-xs font-bold text-[#6b1e1e] flex items-center gap-1.5">
                          <span>{position}</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            {department}
                          </span>
                        </div>
                      </div>

                      {/* ID Number Row & Scannable QR Code */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 tracking-wider">
                            መለያ ቁጥር / ID No:
                          </div>
                          <div className="font-mono text-sm font-black text-blue-900 tracking-wide">
                            {employeeId}
                          </div>
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                            Issue: {hireDate}
                          </div>
                        </div>

                        {/* Scannable Verification QR Code */}
                        <div className="flex flex-col items-center">
                          {qrCodeUrl ? (
                            <div className="p-0.5 rounded bg-white border border-slate-300 shadow-2xs">
                              <img
                                src={qrCodeUrl}
                                alt="QR"
                                className="w-12 h-12 object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded bg-slate-100 border border-slate-300 flex items-center justify-center">
                              <QrIcon size={16} className="text-slate-400" />
                            </div>
                          )}
                          <span className="text-[6.5px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                            VERIFY
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Bottom Corporate Footer Strip (Burgundy tone matching Bunna Bank reference) */}
                  <div className="mt-auto bg-gradient-to-r from-[#450f0f] via-[#5c1616] to-[#7f1d1d] text-white px-3 py-2 flex items-center justify-between text-[9px] font-medium border-t-2 border-amber-400/70">
                    <div className="flex items-center gap-1 text-amber-100">
                      <Phone size={9} className="text-amber-300" />
                      <span>+251 97 566 6667</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-200">
                      <Mail size={9} className="text-amber-300" />
                      <span>info@babaroti.com</span>
                    </div>
                  </div>

                </div>
              ) : (
                /* ═══════════════ BACK OF BADGE ═══════════════ */
                <div className="flex-1 flex flex-col justify-between p-4 bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-800">
                  
                  <div>
                    {/* Header with Emblem */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <BabaRotiIcon size={26} />
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-tight text-slate-900 leading-tight">
                            BABA ROTI CAFÉ
                          </h4>
                          <p className="text-[8px] font-bold text-amber-800 uppercase">Staff Pass Guidelines</p>
                        </div>
                      </div>
                      <div className="font-mono text-[9px] font-bold text-slate-500">
                        {employeeId}
                      </div>
                    </div>

                    {/* Official Card Rules (Amharic & English) */}
                    <div className="mt-2.5 space-y-1.5 text-[9px] text-slate-600 leading-relaxed">
                      <p className="flex items-start gap-1">
                        <span className="text-[#6b1e1e] font-bold">1.</span>
                        <span>ይህ መታወቂያ የባባ ሮቲ ካፌ ንብረት ሲሆን በሥራ ሰዓት መያዝ ግዴታ ነው። / This ID is Baba Roti property.</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="text-[#6b1e1e] font-bold">2.</span>
                        <span>ካርዱ ለሌላ ሰው አሳልፎ መስጠት የተከለከለ ነው። / Strictly non-transferable.</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="text-[#6b1e1e] font-bold">3.</span>
                        <span>ቢጠፋ በአስቸኳይ ለካፌው አስተዳደር ያሳውቁ። / Report immediately if lost.</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="text-[#6b1e1e] font-bold">4.</span>
                        <span>ያገኘ ሰው እባክዎ ለባባ ሮቲ ካፌ ቅርንጫፍ ያስረክቡ። / If found, please return to Baba Roti.</span>
                      </p>
                    </div>
                  </div>

                  {/* Café Info Box */}
                  <div className="my-2 rounded-lg bg-amber-50/80 border border-amber-200/90 p-2 space-y-1 text-[9px]">
                    <div className="font-bold text-[#5c1616] uppercase tracking-wide text-[8.5px] flex items-center gap-1">
                      <Building2 size={10} className="text-[#6b1e1e]" />
                      Baba Roti Café & Restaurant Management
                    </div>
                    <div className="text-slate-700 flex items-center gap-1.5">
                      <Phone size={9} className="text-amber-700 shrink-0" />
                      <span>Tel: +251 97 566 6667 / +251 91 123 4567</span>
                    </div>
                    <div className="text-slate-700 flex items-center gap-1.5">
                      <Mail size={9} className="text-amber-700 shrink-0" />
                      <span>Email: info@babaroti.com · Addis Ababa, Ethiopia</span>
                    </div>
                  </div>

                  {/* Signature & Barcode */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-end justify-between mb-2 px-1">
                      <div>
                        <div className="font-mono text-[8px] text-slate-400">Card Serial</div>
                        <div className="font-mono text-[9px] font-bold text-slate-800">{employeeId}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-serif italic text-xs text-slate-800 tracking-wider border-b border-slate-400 pb-0.5 px-3">
                          Hashem H.
                        </div>
                        <div className="text-[7.5px] text-slate-400 uppercase font-semibold mt-0.5">
                          የሥራ ኃላፊ ፊርማ / Authorized Sign
                        </div>
                      </div>
                    </div>

                    {/* Barcode */}
                    <div className="flex flex-col items-center">
                      <div className="flex items-center justify-center gap-0.5 h-6 px-4">
                        {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3].map((w, i) => (
                          <div
                            key={i}
                            className="h-full bg-slate-900 rounded-xs"
                            style={{ width: `${w}px` }}
                          />
                        ))}
                      </div>
                      <span className="font-mono text-[8px] text-slate-500 tracking-widest mt-0.5">
                        *{employeeId}*
                      </span>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

          {/* Flip Toggle Button under card */}
          <div className="no-print mt-3 flex items-center gap-2">
            <button
              onClick={() => setSide(s => s === 'front' ? 'back' : 'front')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition"
            >
              <RotateCw size={13} className="text-amber-600" />
              <span>Flip to {side === 'front' ? 'Back Side' : 'Front Side'}</span>
            </button>
          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-white border-t border-slate-200">
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(employee);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Change Photo / Info
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition"
            >
              <Printer size={15} />
              Print Badge (CR80)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

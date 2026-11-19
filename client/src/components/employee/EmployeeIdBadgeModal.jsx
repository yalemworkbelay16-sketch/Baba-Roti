import React, { useState, useEffect, useRef } from 'react';
import {
  X, Printer, RotateCw, CheckCircle2, ShieldCheck, Building2,
  Calendar, Phone, Mail, Award, Sparkles, User, QrCode as QrIcon
} from 'lucide-react';
import QRCode from 'qrcode';
import { BabaRotiIcon } from '../ui/BabaRotiLogo';
import { normalizeFileUrl } from '../../utils/fileUrl';

/**
 * Digital Employee ID Badge Modal
 * Generates an attractive, professional 3x4 photo staff ID card
 * with scannable QR code, front/back flip views, and print-ready layout.
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
  const badgeRef = useRef(null);

  const fullName = employee
    ? (employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`).trim()
    : '';

  const employeeId = employee?.employeeId || 'EMP-0001';
  const position = employee?.position || 'Staff Member';
  const department = employee?.department || 'Operations';
  const hireDate = employee?.hireDate
    ? new Date(employee.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Active';

  // Generate QR Code data URL
  useEffect(() => {
    if (!employee) return;
    const qrPayload = JSON.stringify({
      empId: employee.employeeId || 'EMP-0001',
      name: fullName,
      dept: employee.department || 'Operations',
      role: employee.position || 'Staff',
      org: 'Baba Roti Café',
      verify: 'AUTHORIZED',
    });

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('QR code generation failed:', err));
  }, [employee, fullName]);

  if (!open || !employee) return null;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  const photoSrc = employee.photoUrl ? normalizeFileUrl(employee.photoUrl) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      
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
            top: 40px !important;
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

      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-auto">

        {/* Modal Header */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#3b0f0f] via-[#5c1616] to-[#7f1d1d] text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
              <Award className="h-4 w-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Digital Staff Identity Badge
                {isNewlyCreated && (
                  <span className="text-[10px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    ✨ Registered!
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-amber-200/80">Official Baba Roti Café Pass</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSide(s => s === 'front' ? 'back' : 'front')}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-100 transition"
              title="Flip card between Front and Back"
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

        {/* Modal Body / Badge Preview Canvas */}
        <div className="p-4 sm:p-6 bg-slate-100/80 flex flex-col items-center justify-center overflow-y-auto">

          {/* Newly created celebration banner */}
          {isNewlyCreated && (
            <div className="no-print w-full max-w-xs mb-3 text-center bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>Employee profile & ID Badge created successfully!</span>
            </div>
          )}

          {/* The Physical Card Container */}
          <div
            id="printable-employee-badge-area"
            ref={badgeRef}
            className="w-[330px] sm:w-[350px] rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col relative transition-all duration-300 select-none"
            style={{
              minHeight: '520px',
            }}
          >
            {/* Lanyard Punch Hole with metallic rim */}
            <div className="w-full flex justify-center pt-2.5 pb-1 bg-white relative z-10">
              <div className="w-14 h-3.5 rounded-full bg-slate-200 border-2 border-slate-300 shadow-inner flex items-center justify-center">
                <div className="w-10 h-1.5 rounded-full bg-slate-300/80" />
              </div>
            </div>

            {side === 'front' ? (
              /* ═══════════════ FRONT SIDE OF BADGE ═══════════════ */
              <div className="flex-1 flex flex-col">

                {/* Card Top Banner with Baba Roti Branding */}
                <div className="bg-gradient-to-br from-[#450f0f] via-[#5c1616] to-[#7f1d1d] text-white px-4 pt-3 pb-4 text-center relative overflow-hidden">
                  {/* Decorative background circles */}
                  <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-amber-400/10 pointer-events-none" />
                  <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-amber-400/10 pointer-events-none" />

                  <div className="flex items-center justify-center gap-2 mb-1">
                    <BabaRotiIcon size={32} className="ring-2 ring-amber-400/80 shadow-md" />
                    <div className="text-left">
                      <span className="block text-xs font-black tracking-tight text-white leading-tight">
                        BABA ROTI
                      </span>
                      <span className="block text-[9px] font-semibold tracking-wider text-amber-300 uppercase">
                        Café & Restaurant
                      </span>
                    </div>
                  </div>

                  {/* Gold Divider */}
                  <div className="h-0.5 w-24 mx-auto bg-gradient-to-r from-transparent via-amber-400 to-transparent my-1.5" />

                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-[9px] font-bold text-amber-200 tracking-wider uppercase">
                    <ShieldCheck size={10} className="text-amber-300" />
                    STAFF IDENTITY PASS
                  </div>
                </div>

                {/* 3x4 Passport Photo Area */}
                <div className="flex flex-col items-center -mt-6 relative z-10">
                  <div
                    className="relative rounded-xl overflow-hidden shadow-lg border-3 border-white bg-slate-100 flex items-center justify-center ring-2 ring-amber-400/70"
                    style={{
                      width: '120px',
                      height: '160px', // Exact 3:4 passport aspect ratio
                    }}
                  >
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={fullName}
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 text-slate-400 p-2 text-center">
                        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 font-bold text-lg flex items-center justify-center border border-amber-300 mb-1">
                          {employee.firstName?.[0] || 'E'}{employee.lastName?.[0] || 'P'}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">3×4 Photo</span>
                        <span className="text-[8px] text-slate-400">Passport View</span>
                      </div>
                    )}

                    {/* Active Status Ribbon Dot */}
                    <div
                      className={`absolute top-1.5 right-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                        employee.status === 'active'
                          ? 'bg-emerald-500'
                          : employee.status === 'on_leave'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      title={employee.status || 'Active'}
                    />
                  </div>
                </div>

                {/* Employee Details Information */}
                <div className="px-5 pt-3 pb-2 text-center">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight uppercase leading-snug">
                    {fullName}
                  </h3>

                  {/* Position / Job Title Banner */}
                  <div className="mt-1 inline-block">
                    <span className="px-3 py-1 rounded-md bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wide shadow-xs">
                      {position}
                    </span>
                  </div>

                  {/* Department & ID Row */}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold">
                      <Building2 size={11} className="text-blue-600" />
                      {department}
                    </span>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {employeeId}
                    </span>
                  </div>
                </div>

                {/* Scannable QR Code & Issue Date */}
                <div className="mt-auto px-5 pt-2 pb-3 bg-gradient-to-b from-white to-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                      Issued On
                    </div>
                    <div className="text-[11px] font-bold text-slate-700">
                      {hireDate}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-700 font-bold">
                      <CheckCircle2 size={10} className="text-emerald-600" />
                      <span>OFFICIAL PASS</span>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center">
                    {qrCodeUrl ? (
                      <div className="p-1 rounded-lg bg-white border border-slate-200 shadow-xs">
                        <img
                          src={qrCodeUrl}
                          alt="Verification QR"
                          className="w-14 h-14 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <QrIcon size={20} className="text-slate-400" />
                      </div>
                    )}
                    <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                      SCAN TO VERIFY
                    </span>
                  </div>
                </div>

                {/* Holographic Security Micro-strip */}
                <div className="py-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 text-[8px] font-black tracking-widest text-slate-950 uppercase text-center flex items-center justify-center gap-1">
                  <Sparkles size={8} />
                  <span>AUTHORIZED STAFF · BABA ROTI CAFÉ</span>
                  <Sparkles size={8} />
                </div>

              </div>
            ) : (
              /* ═══════════════ BACK SIDE OF BADGE ═══════════════ */
              <div className="flex-1 flex flex-col justify-between p-5 bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-800">
                
                <div>
                  {/* Back Header */}
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                    <BabaRotiIcon size={28} />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-tight text-slate-900 leading-tight">
                        Terms & Conditions
                      </h4>
                      <p className="text-[9px] text-slate-500">Baba Roti Staff Guidelines</p>
                    </div>
                  </div>

                  {/* Guidelines list */}
                  <div className="mt-3 space-y-2 text-[10px] text-slate-600 leading-relaxed">
                    <p className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">1.</span>
                      <span>This card is non-transferable and remains the property of Baba Roti Café & Restaurant.</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">2.</span>
                      <span>Must be visibly worn or presented upon request during official working hours.</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">3.</span>
                      <span>Report immediately to Management if lost, stolen, or misplaced.</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">4.</span>
                      <span>If found, please return to any Baba Roti Café branch or contact our office.</span>
                    </p>
                  </div>
                </div>

                {/* Emergency Contact & Café Info */}
                <div className="mt-4 rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 space-y-1.5 text-[10px]">
                  <div className="font-bold text-amber-900 uppercase tracking-wide text-[9px] flex items-center gap-1">
                    <Building2 size={11} className="text-amber-700" />
                    Baba Roti Café Management
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone size={10} className="text-amber-700 shrink-0" />
                    <span>Tel: +251 97 566 6667 / 091 123 4567</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail size={10} className="text-amber-700 shrink-0" />
                    <span>Email: info@babaroti.com</span>
                  </div>
                </div>

                {/* Signature & Barcode Section */}
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="flex items-end justify-between mb-3 px-2">
                    <div className="text-left">
                      <div className="font-mono text-[9px] text-slate-400">Card Serial</div>
                      <div className="font-mono text-[10px] font-bold text-slate-800">{employeeId}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-serif italic text-xs text-slate-700 tracking-wide border-b border-slate-400 pb-0.5 px-3">
                        Hashem H.
                      </div>
                      <div className="text-[8px] text-slate-400 uppercase font-semibold mt-0.5">
                        Authorized Signature
                      </div>
                    </div>
                  </div>

                  {/* Stylized Barcode Graphic */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center gap-0.5 h-7 px-4">
                      {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3].map((w, i) => (
                        <div
                          key={i}
                          className="h-full bg-slate-900 rounded-xs"
                          style={{ width: `${w}px` }}
                        />
                      ))}
                    </div>
                    <span className="font-mono text-[9px] text-slate-500 tracking-widest mt-1">
                      *{employeeId}*
                    </span>
                  </div>
                </div>

              </div>
            )}

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

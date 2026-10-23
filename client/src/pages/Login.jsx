import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Phone, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { BabaRotiIcon } from '../components/ui/BabaRotiLogo';

/* ─── role quick-fill data ─────────────────────────────────────── */
const ROLES = [
  { label: 'Admin', email: 'admin@hotel.com' },
  { label: 'Manager', email: 'manager@hotel.com' },
  { label: 'Supervisor', email: 'supervisor@hotel.com' },
  { label: 'Store Keeper', email: 'storekeeper@hotel.com' },
  { label: 'Cashier', email: 'cashier@hotel.com' },
  { label: 'Waiter', email: 'waiter@hotel.com' },
];

/* ─── Starburst / asterisk SVG logo mark ───────────────────────── */
function Starburst() {
  return (
    <svg
      width="64" height="64" viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 3 crossing rounded strokes */}
      <line x1="32" y1="4" x2="32" y2="60" stroke="white" strokeWidth="7" strokeLinecap="round" />
      <line x1="4" y1="32" x2="60" y2="32" stroke="white" strokeWidth="7" strokeLinecap="round" />
      <line x1="10" y1="10" x2="54" y2="54" stroke="white" strokeWidth="7" strokeLinecap="round" />
      <line x1="54" y1="10" x2="10" y2="54" stroke="white" strokeWidth="7" strokeLinecap="round" />
      <line x1="5" y1="20" x2="59" y2="44" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
      <line x1="5" y1="44" x2="59" y2="20" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/* ─── Decorative curved SVG lines for left panel ───────────────── */
function CurvedLines() {
  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="580" cy="80" rx="340" ry="340" stroke="white" strokeWidth="1.2" opacity="0.14" />
      <ellipse cx="580" cy="80" rx="260" ry="260" stroke="white" strokeWidth="1.2" opacity="0.14" />
      <ellipse cx="580" cy="80" rx="180" ry="180" stroke="white" strokeWidth="1.2" opacity="0.14" />
      <ellipse cx="580" cy="80" rx="100" ry="100" stroke="white" strokeWidth="1.2" opacity="0.14" />
    </svg>
  );
}
/* ─── Floating-label input ──────────────────────────────────────── */
const FloatingInput = React.forwardRef(function FloatingInput({
  id, label, type = 'text', value, onChange,
  autoComplete, required, hasError, errorMsg,
  suffix,
}, ref) {
  const filled = value.length > 0;
  return (
    <div className="login-field">
      <div
        className={[
          'login-field__wrap',
          hasError ? 'login-field__wrap--error' : '',
        ].join(' ')}
      >
        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          placeholder=" "
          aria-describedby={hasError ? `${id}-err` : undefined}
          aria-invalid={hasError || undefined}
          className="login-field__input"
        />
        <label htmlFor={id} className={['login-field__label', filled ? 'login-field__label--filled' : ''].join(' ')}>
          {label}
        </label>
        {suffix && <span className="login-field__suffix">{suffix}</span>}
      </div>
      {hasError && (
        <p id={`${id}-err`} role="alert" className="login-field__error">
          {errorMsg}
        </p>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   Login page
═══════════════════════════════════════════════════════════════════ */
export default function Login() {
  // ── OTP gate state ──────────────────────────────────────────
  const [step, setStep] = useState('phone');  // 'phone' | 'otp' | 'login'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');       // short-lived JWT after OTP verified
  const [userId, setUserId] = useState('');
  const [maskedName, setMaskedName] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);       // countdown seconds

  // ── Login form state ────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [activeRole, setActiveRole] = useState('Admin');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const passwordRef = useRef(null);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // ── Resend countdown ────────────────────────────────────────
  React.useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── Step 1: Request OTP ─────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!phone.trim()) { setOtpError('Please enter your phone number.'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      const res = await api.post('/auth/request-otp', { phone: phone.trim() });
      setUserId(res.data.userId || '');
      setMaskedName(res.data.maskedName || '');
      setStep('otp');
      setResendTimer(60);
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally { setOtpLoading(false); }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length < 6) { setOtpError('Please enter the full 6-digit OTP.'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      const res = await api.post('/auth/verify-otp', { userId, otp });
      setOtpToken(res.data.otpToken);
      setStep('login');
      setOtp('');
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid OTP. Please try again.');
      setOtp('');
      otpRefs[0]?.current?.focus();
    } finally { setOtpLoading(false); }
  };

  // Handle OTP digit box input
  const handleOtpKey = (idx, value) => {
    const digits = otp.split('');
    digits[idx] = value.slice(-1);
    const newOtp = digits.join('').slice(0, 6);
    setOtp(newOtp);
    if (value && idx < 5) otpRefs[idx + 1]?.current?.focus();
  };

  /* validation */
  const emailErr = touched.email && !email.trim();
  const passwordErr = touched.password && !password;

  /* ── handlers (unchanged logic) ─────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email.trim() || !password) return;
    setServerError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password, otpToken);
      if (loggedUser?.role === 'waiter') {
        navigate('/pos', { replace: true });
      } else {
        navigate(location.state?.from || '/', { replace: true });
      }
    } catch (err) {
      setServerError(
        err.response?.data?.message ||
        'Invalid credentials. Please verify your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role) => {
    setEmail(role.email);
    setPassword('admin123');
    setActiveRole(role.label);
    setServerError('');
    setTouched({ email: false, password: false });
    setTimeout(() => passwordRef.current?.focus(), 0);
  };

  return (
    <>
      {/* ── per-page scoped styles ─────────────────────────────── */}
      <style>{`
        /* font */
        .login-root * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

        /* ── layout ── */
        .login-root {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          min-height: 100dvh;
          background: #fff;
        }
        @media (max-width: 900px) {
          .login-root { grid-template-columns: 1fr; }
        }

        /* ── LEFT PANEL ── */
        .login-hero {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: clamp(2rem, 5vw, 4rem);
          overflow: hidden;
          background: linear-gradient(160deg, #2b4bd0 0%, #1b34a8 55%, #0f2487 100%);
          /* radial glow top-left */
          background-image:
            radial-gradient(ellipse 70% 55% at 0% 0%, #3b5bdb 0%, transparent 65%),
            linear-gradient(160deg, #2b4bd0 0%, #1b34a8 55%, #0f2487 100%);
          box-shadow: 12px 0 40px -10px rgba(15,36,135,.35);
          color: #fff;
        }
        @media (max-width: 900px) {
          .login-hero { padding: 2.5rem 1.75rem 2rem; }
        }

        .login-hero__content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin: auto 0;
          padding: 3rem 0;
          max-width: 34ch;
        }
        @media (max-width: 900px) {
          .login-hero__content { padding: 2rem 0 1.5rem; max-width: 100%; }
        }

        .login-hero__heading {
          font-size: clamp(40px, 5vw, 62px);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.03em;
          margin: 0;
        }

        .login-hero__wave {
          display: inline-block;
          animation: wave 1s ease-in-out 0.3s 1 both;
          transform-origin: 70% 80%;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-hero__wave { animation: none; }
        }
        @keyframes wave {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(-15deg); }
          50%  { transform: rotate(18deg); }
          75%  { transform: rotate(-8deg); }
          100% { transform: rotate(0deg); }
        }

        .login-hero__desc {
          margin: 0;
          font-size: 1rem;
          line-height: 1.65;
          color: #dbe4ff;
          max-width: 40ch;
        }

        .login-hero__footer {
          position: relative;
          z-index: 1;
          font-size: 0.72rem;
          color: rgba(219,228,255,.65);
          border-top: 1px solid rgba(255,255,255,.15);
          padding-top: 1.25rem;
        }

        /* ══════════════════════════════════════════
           RIGHT PANEL — always light, never dark
        ══════════════════════════════════════════ */
        .login-form-panel {
          display: flex;
          flex-direction: column;
          /* soft blue-white gradient background */
          background: linear-gradient(155deg, #f0f4ff 0%, #e8effe 40%, #f5f8ff 100%);
          color-scheme: light;
        }

        .login-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(1.25rem, 2.5vw, 1.75rem) clamp(1.5rem, 5vw, 3rem);
        }

        .login-wordmark {
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: -0.025em;
          line-height: 1;
        }
        .login-wordmark__five { color: #0f172a; }
        .login-wordmark__stop { color: #2563eb; }

        .login-status {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.72rem;
          color: #475569;
          background: rgba(255,255,255,.75);
          border: 1px solid #dbeafe;
          padding: 0.3rem 0.7rem;
          border-radius: 999px;
          backdrop-filter: blur(4px);
        }
        .login-status__dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
          box-shadow: 0 0 0 2px rgba(34,197,94,.25);
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-status__dot { animation: none; }
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,.25); }
          50%       { box-shadow: 0 0 0 5px rgba(34,197,94,.0); }
        }

        /* centred form card */
        .login-form-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem clamp(1.25rem, 4vw, 2.5rem);
        }

        /* the white glassy card */
        .login-form-block {
          width: 100%;
          max-width: 400px;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(219,234,254,.8);
          border-radius: 20px;
          box-shadow:
            0 4px 6px -1px rgba(37,99,235,.06),
            0 20px 50px -12px rgba(37,99,235,.12),
            0 0 0 1px rgba(255,255,255,.6) inset;
          padding: 2.25rem 2rem 1.75rem;
          backdrop-filter: blur(12px);
        }
        @media (max-width: 900px) {
          .login-form-block { padding: 1.75rem 1.5rem; }
        }

        /* tiny blue accent bar at top of card */
        .login-form-block::before {
          content: '';
          display: block;
          height: 3px;
          border-radius: 3px 3px 0 0;
          background: linear-gradient(90deg, #2563eb, #60a5fa);
          margin: -2.25rem -2rem 1.75rem;
          border-radius: 19px 19px 0 0;
        }

        .login-heading {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.025em;
          margin: 0 0 0.35rem;
        }
        .login-subtext {
          font-size: 0.8rem;
          color: #64748b;
          line-height: 1.55;
          margin: 0 0 1.5rem;
        }

        /* ── floating-label fields ── */
        .login-field { margin-bottom: 1.25rem; }

        .login-field__wrap {
          position: relative;
          background: #f8faff;
          border: 1.5px solid #dbeafe;
          border-radius: 10px;
          transition: border-color .2s, box-shadow .2s, background .2s;
        }
        .login-field__wrap:focus-within {
          border-color: #2563eb;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(37,99,235,.1);
        }
        .login-field__wrap--error {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220,38,38,.08) !important;
        }

        .login-field__input {
          display: block;
          width: 100%;
          padding: 1.45rem 2.5rem 0.5rem 0.9rem;
          background: transparent;
          border: none;
          outline: none;
          font-size: 0.875rem;
          color: #0f172a;
          font-family: inherit;
          border-radius: 10px;
        }
        .login-field__input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #f8faff inset;
          -webkit-text-fill-color: #0f172a;
        }

        .login-field__label {
          position: absolute;
          left: 0.9rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.875rem;
          color: #64748b;
          pointer-events: none;
          transition: top .18s, font-size .18s, color .18s, transform .18s;
        }
        .login-field__input:focus + .login-field__label,
        .login-field__input:not(:placeholder-shown) + .login-field__label,
        .login-field__label--filled {
          top: 0.5rem;
          transform: translateY(0);
          font-size: 0.68rem;
          color: #2563eb;
          font-weight: 700;
          letter-spacing: .02em;
        }
        .login-field__wrap--error .login-field__input:focus + .login-field__label,
        .login-field__wrap--error .login-field__input:not(:placeholder-shown) + .login-field__label,
        .login-field__wrap--error .login-field__label--filled { color: #dc2626; }

        .login-field__suffix {
          position: absolute;
          right: 0.7rem;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
        }
        .login-field__suffix button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.3rem;
          color: #94a3b8;
          display: flex;
          align-items: center;
          border-radius: 6px;
          transition: color .15s;
        }
        .login-field__suffix button:hover { color: #2563eb; }
        .login-field__suffix button:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .login-field__error {
          margin: 0.3rem 0 0 0.15rem;
          font-size: 0.7rem;
          color: #dc2626;
        }

        /* ── banners ── */
        .login-server-error {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 0.65rem 0.85rem;
          font-size: 0.78rem;
          color: #dc2626;
          margin-bottom: 1.2rem;
        }
        .login-timeout-banner {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 10px;
          padding: 0.65rem 0.85rem;
          font-size: 0.78rem;
          color: #92400e;
          margin-bottom: 1.2rem;
        }

        /* ── primary button ── */
        .login-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          height: 50px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
          font-size: 0.9rem;
          font-weight: 700;
          font-family: inherit;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity .18s, transform .1s, box-shadow .18s;
          box-shadow: 0 4px 14px rgba(37,99,235,.4), 0 1px 3px rgba(37,99,235,.3);
          margin-top: 0.5rem;
          letter-spacing: .01em;
        }
        .login-btn-primary:hover:not(:disabled) {
          opacity: .92;
          box-shadow: 0 6px 20px rgba(37,99,235,.45), 0 2px 6px rgba(37,99,235,.3);
          transform: translateY(-1px);
        }
        .login-btn-primary:active:not(:disabled) { transform: scale(.988) translateY(0); }
        .login-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .login-btn-primary:focus-visible {
          outline: 3px solid #93c5fd;
          outline-offset: 2px;
        }

        .login-spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin .7s linear infinite;
          flex-shrink: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-spinner { animation: none; border-top-color: rgba(255,255,255,.6); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── divider ── */
        .login-divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 1.4rem 0 0.9rem;
          color: #94a3b8;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .login-divider::before,
        .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        /* ── role switcher ── */
        .login-roles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.45rem;
        }
        .login-role-btn {
          padding: 0.5rem 0.25rem;
          background: #fff;
          border: 1.5px solid #dbeafe;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #334155;
          font-family: inherit;
          cursor: pointer;
          transition: border-color .15s, background .15s, color .15s, box-shadow .15s;
          text-align: center;
          white-space: nowrap;
        }
        .login-role-btn:hover {
          border-color: #2563eb;
          color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 2px 8px rgba(37,99,235,.12);
        }
        .login-role-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        .login-role-btn--active {
          border-color: #2563eb !important;
          background: #eff6ff !important;
          color: #2563eb !important;
          box-shadow: 0 2px 8px rgba(37,99,235,.15) !important;
        }

        /* ── OTP steps ── */
        .otp-step { animation: fadeIn .25s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        .otp-step__title {
          font-size: 1.4rem; font-weight: 800; color: #0f172a;
          letter-spacing: -.025em; margin: 0 0 .3rem;
        }
        .otp-step__sub {
          font-size: .8rem; color: #64748b; line-height: 1.5; margin: 0 0 1.6rem;
        }
        .otp-boxes {
          display: flex; gap: .55rem; justify-content: center; margin: 1.5rem 0;
        }
        .otp-box {
          width: 44px; height: 52px;
          border: 2px solid #dbeafe; border-radius: 10px;
          background: #f8faff; font-size: 1.4rem; font-weight: 800;
          color: #0f172a; text-align: center;
          outline: none; transition: border-color .18s, box-shadow .18s;
          font-family: inherit;
        }
        .otp-box:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); background: #fff; }
        .otp-resend {
          text-align: center; font-size: .76rem; color: #64748b; margin-top: .5rem;
        }
        .otp-resend button {
          color: #2563eb; font-weight: 700; background: none; border: none;
          cursor: pointer; font-family: inherit; font-size: .76rem;
        }
        .otp-resend button:disabled { color: #94a3b8; cursor: default; }
        .otp-verified-badge {
          display: inline-flex; align-items: center; gap: .4rem;
          background: #f0fdf4; border: 1px solid #bbf7d0;
          color: #166534; border-radius: 999px; padding: .25rem .75rem;
          font-size: .72rem; font-weight: 700; margin-bottom: 1.2rem;
        }
        .phone-input-wrap {
          display: flex; align-items: center; gap: .5rem;
          background: #f8faff; border: 1.5px solid #dbeafe;
          border-radius: 10px; transition: border-color .2s, box-shadow .2s;
          padding: 0 .9rem;
        }
        .phone-input-wrap:focus-within {
          border-color: #2563eb; background: #fff;
          box-shadow: 0 0 0 3px rgba(37,99,235,.1);
        }
        .phone-input-wrap input {
          flex: 1; border: none; outline: none; background: transparent;
          font-size: .875rem; color: #0f172a; padding: 1.1rem 0;
          font-family: inherit;
        }

        /* ── forgot password ── */
        .login-forgot {
          margin-top: 1rem;
          text-align: center;
          font-size: 0.77rem;
          color: #64748b;
        }
        .login-forgot span {
          color: #2563eb;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
        }
        .login-forgot span:hover { text-decoration: underline; }

        /* ── right panel footer ── */
        .login-footer {
          padding: 0.9rem clamp(1.5rem, 5vw, 3rem) 1.25rem;
          border-top: 1px solid rgba(219,234,254,.7);
          font-size: 0.71rem;
          color: #64748b;
          background: rgba(255,255,255,.5);
        }
        .login-footer__top {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.4rem 0.9rem;
          margin-bottom: 0.5rem;
        }
        .login-footer__name { font-weight: 700; color: #0f172a; }
        .login-footer__pills { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
        .login-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.18rem 0.55rem;
          border-radius: 999px;
          font-size: 0.67rem;
          font-weight: 700;
          text-decoration: none;
          transition: filter .15s;
        }
        .login-pill:hover { filter: brightness(.92); }
        .login-pill--tg { background: #e0f2fe; color: #0369a1; }
        .login-pill--wa { background: #dcfce7; color: #166534; }
        .login-footer__phone { font-variant-numeric: tabular-nums; color: #0f172a; font-weight: 600; font-size: 0.73rem; }
        .login-footer__bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.35rem;
        }
        .login-footer__support {
          color: #2563eb;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          font-size: 0.71rem;
        }
        .login-footer__support:hover { text-decoration: underline; }
        .login-footer__auth { font-size: 0.68rem; color: #94a3b8; font-weight: 600; }

        /* ── dark mode: keep the right panel always light ──────── */
        @media (prefers-color-scheme: dark) {
          /* force light on every element inside the right panel */
          .login-form-panel,
          .login-form-panel * {
            color-scheme: light;
          }
          /* panel background stays the same light blue gradient */
          .login-form-panel {
            background: linear-gradient(155deg, #f0f4ff 0%, #e8effe 40%, #f5f8ff 100%);
          }
        }
      `}</style>

      <div className="login-root">

        {/* ════════════════════ LEFT — HERO ════════════════════ */}
        <section className="login-hero" aria-label="Application branding">
          <CurvedLines />

          {/* Baba Roti Café Official Emblem */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="rounded-full p-2.5 shadow-2xl ring-4 ring-amber-400/40 inline-block bg-white/95 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:ring-amber-400/70">
              <BabaRotiIcon size={96} className="shadow-none ring-0" />
            </div>
          </div>

          {/* headline + body */}
          <div className="login-hero__content">
            <h1 className="login-hero__heading">
              Hello<br />
              Baba Roti Café!&nbsp;
              <span className="login-hero__wave" role="img" aria-label="waving hand">👋</span>
            </h1>
            <p className="login-hero__desc">
              Run every store and kitchen from one desk. Receive goods, cost recipes,
              approve vouchers and balance the stock ledger without the paperwork.
            </p>
          </div>

          {/* left footer */}
          <footer className="login-hero__footer">
            © 2026 Baba Roti Café Hotel &amp; Resort Management SC. All rights reserved.
          </footer>
        </section>

        {/* ════════════════════ RIGHT — FORM ════════════════════ */}
        <main className="login-form-panel">

          {/* top bar */}
          <div className="login-topbar">
            <div className="flex items-center gap-2.5">
              <BabaRotiIcon size={32} className="ring-2 ring-amber-400/50 shadow-sm" />
              <span className="login-wordmark flex items-center gap-1" aria-label="Baba Roti Café">
                <span className="login-wordmark__five">Baba </span>
                <span className="login-wordmark__stop">Roti</span>
                <span className="ml-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-950 shadow-xs">Café</span>
              </span>
            </div>
            <div className="login-status" aria-live="polite">
              <span className="login-status__dot" aria-hidden="true" />
              System online
            </div>
          </div>

          {/* centred form block */}
          <div className="login-form-wrap">
            <div className="login-form-block">

              {/* ══ STEP 1: Phone number ══ */}
              {step === 'phone' && (
                <div className="otp-step">
                  <h2 className="otp-step__title">Verify your identity</h2>
                  <p className="otp-step__sub">
                    Enter your registered phone number. We'll send a one-time code to your Telegram.
                  </p>

                  {otpError && (
                    <div className="login-server-error" role="alert">
                      <span aria-hidden="true">⚠</span><span>{otpError}</span>
                    </div>
                  )}

                  <form onSubmit={handleRequestOtp}>
                    <label style={{ fontSize: '.7rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '.4rem' }}>
                      Phone Number
                    </label>
                    <div className="phone-input-wrap">
                      <Phone size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setOtpError(''); }}
                        placeholder="e.g. 0911192xxx or +2517012xxx"
                        autoComplete="tel"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={otpLoading}
                      className="login-btn-primary"
                      style={{ marginTop: '1.2rem' }}
                    >
                      {otpLoading ? (
                        <><span className="login-spinner" aria-hidden="true" />Sending OTP…</>
                      ) : (
                        <>Send OTP via Telegram <ArrowRight size={16} /></>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* ══ STEP 2: Enter OTP ══ */}
              {step === 'otp' && (
                <div className="otp-step">
                  <h2 className="otp-step__title">Enter OTP</h2>
                  <p className="otp-step__sub">
                    A 6-digit code was sent to <strong>{maskedName ? maskedName + "'s" : 'your'}</strong> Telegram.{' '}
                    Check <strong>@BabarotiBot</strong> and enter the code below.
                  </p>

                  {otpError && (
                    <div className="login-server-error" role="alert">
                      <span aria-hidden="true">⚠</span><span>{otpError}</span>
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp}>
                    <div className="otp-boxes">
                      {[0, 1, 2, 3, 4, 5].map(idx => (
                        <input
                          key={idx}
                          ref={otpRefs[idx]}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={otp[idx] || ''}
                          onChange={e => handleOtpKey(idx, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
                              otpRefs[idx - 1]?.current?.focus();
                            }
                          }}
                          onPaste={e => {
                            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                            if (text) { setOtp(text); setTimeout(() => otpRefs[Math.min(text.length, 5)]?.current?.focus(), 0); }
                            e.preventDefault();
                          }}
                          className="otp-box"
                          autoFocus={idx === 0}
                          aria-label={`OTP digit ${idx + 1}`}
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={otpLoading || otp.length < 6}
                      className="login-btn-primary"
                    >
                      {otpLoading ? (
                        <><span className="login-spinner" aria-hidden="true" />Verifying…</>
                      ) : 'Verify Code'}
                    </button>
                  </form>

                  <div className="otp-resend">
                    {resendTimer > 0
                      ? <span>Resend in {resendTimer}s</span>
                      : <><span>Didn't receive it? </span>
                        <button type="button" onClick={() => { setStep('phone'); setOtp(''); setOtpError(''); }}>
                          Go back & resend
                        </button>
                      </>
                    }
                  </div>
                </div>
              )}

              {/* ══ STEP 3: Email + Password login ══ */}
              {step === 'login' && (
                <div className="otp-step">

                  {/* OTP verified badge */}
                  <div className="otp-verified-badge">
                    ✅ Phone verified — sign in to continue
                  </div>

                  <h2 className="login-heading">Welcome back!</h2>
                  <p className="login-subtext">
                    Sign in with the credentials from Store Management or IT Administration.
                  </p>

                  {/* session timeout notice */}
                  {location.state?.sessionExpired && !serverError && (
                    <div className="login-timeout-banner" role="alert">
                      <strong>Session timeout —</strong> You were automatically signed out after{' '}
                      {location.state?.timeoutMinutes || 2} minutes of inactivity. Please sign in again.
                    </div>
                  )}

                  {serverError && (
                    <div className="login-server-error" role="alert">
                      <span aria-hidden="true">⚠</span>
                      <span>{serverError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} noValidate>
                    <FloatingInput
                      id="login-email"
                      label="Email / Institutional ID"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="username"
                      required
                      hasError={touched.email && !email.trim()}
                      errorMsg="Enter your email or institutional ID."
                    />
                    <FloatingInput
                      ref={passwordRef}
                      id="login-password"
                      label="Password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      hasError={touched.password && !password}
                      errorMsg="Enter your password."
                      suffix={
                        <button type="button" onClick={() => setShowPw(v => !v)}
                          aria-label={showPw ? 'Hide password' : 'Show password'}>
                          {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      }
                    />

                    <button
                      id="login-submit" type="submit" disabled={loading}
                      className="login-btn-primary" aria-busy={loading}
                    >
                      {loading ? (
                        <><span className="login-spinner" aria-hidden="true" />Signing in…</>
                      ) : 'Sign in'}
                    </button>
                  </form>

                  <p className="login-forgot">
                    Forgot your password?{' '}
                    <span role="button" tabIndex={0}>Reset credentials</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* right panel footer */}
          <footer className="login-footer">
            <div className="login-footer__top">
              <span>Developed By <span className="login-footer__name">Mega Tech Teams</span></span>
            </div>
            <div className="login-footer__bottom">
              <a
                href="mailto:support@Baba Roti  Café.com"
                className="login-footer__support"
              >
                Contact support
              </a>
              <span className="login-footer__auth">Authorized access only</span>
            </div>
          </footer>

        </main>
      </div>
    </>
  );
}

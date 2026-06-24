import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import {
  Eye, EyeOff, Lock, Mail, User, ArrowRight, ArrowLeft, Shield, Hexagon,
  KeyRound, RefreshCcw, CheckCircle2, ShieldCheck, Loader2, Check,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  MOCK API LAYER — replace these with real calls to your backend.   */
/*  Each one currently just waits, then resolves/rejects so the UI    */
/*  can be wired up and demoed before the API exists.                 */
/* ------------------------------------------------------------------ */

const mockSendOtp = (_email: string) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 900);
  });

const mockVerifyOtp = (code: string) =>
  new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      if (code.length === 6) resolve();
      else reject(new Error('Invalid code'));
    }, 900);
  });

const mockSendResetEmail = (_email: string) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 900);
  });

/* ------------------------------------------------------------------ */
/*  Shared bits                                                       */
/* ------------------------------------------------------------------ */

const FormInput = ({ icon: Icon, type, placeholder, label, delay, value, onChange }: { icon: any, type: string, placeholder: string, label: string, delay: number, value?: string, onChange?: (v: string) => void }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="space-y-1.5 w-full"
    >
      <label className="text-[13px] text-slate-300 font-medium ml-1 tracking-wide">{label}</label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Icon className="h-4 w-4 text-slate-400 group-focus-within:text-blue-400 transition-colors duration-300" />
        </div>
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-slate-900/40 border border-white/5 focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-blue-500/50 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 transition-all duration-300 outline-none shadow-inner"
          placeholder={placeholder}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer text-slate-400 hover:text-slate-200 transition-colors z-10"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
        <div className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 ring-1 ring-blue-500/30 blur-[2px] transition-opacity duration-300 pointer-events-none" />
      </div>
    </motion.div>
  );
};

/** Six-box OTP entry. Auto-advances focus, supports backspace and paste. */
const OtpInput = ({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = useMemo(() => {
    const arr = value.split('');
    while (arr.length < length) arr.push('');
    return arr;
  }, [value, length]);

  const setDigit = (i: number, d: string) => {
    const next = [...digits];
    next[i] = d;
    onChange(next.join('').slice(0, length));
  };

  const handleChange = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '').slice(-1);
    setDigit(i, d);
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      e.preventDefault();
      onChange(pasted.padEnd(length, '').slice(0, length).trimEnd());
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          inputMode="numeric"
          maxLength={1}
          className="w-full aspect-square text-center text-lg font-semibold text-white bg-slate-900/40 border border-white/5 focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-blue-500/50 rounded-xl outline-none transition-all duration-300 shadow-inner"
        />
      ))}
    </div>
  );
};

/**
 * Slide-to-fit puzzle captcha. Drag the notched piece along the track
 * until it lines up with the matching slot outline. Snaps + turns green
 * on success, springs back and shakes on a miss.
 */
const SlideCaptcha = ({ onVerify, verified }: { onVerify: (ok: boolean) => void; verified: boolean }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [targetX, setTargetX] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const pieceSize = 44;
  const x = useMotionValue(0);

  useEffect(() => {
    const measure = () => setTrackWidth(trackRef.current?.clientWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (trackWidth > 0 && targetX === null) {
      const max = trackWidth - pieceSize;
      setTargetX(Math.round(max * (0.55 + Math.random() * 0.3)));
    }
  }, [trackWidth, targetX]);

  const reset = () => {
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    onVerify(false);
  };

  const handleDragEnd = () => {
    if (verified || targetX === null) return;
    const current = x.get();
    const tolerance = 8;
    if (Math.abs(current - targetX) <= tolerance) {
      animate(x, targetX, { type: 'spring', stiffness: 400, damping: 30 });
      onVerify(true);
    } else {
      setShake(true);
      reset();
      setTimeout(() => setShake(false), 400);
    }
  };

  const maxDrag = Math.max(trackWidth - pieceSize, 0);

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-slate-400 ml-1">
        {verified ? 'Verified' : 'Slide the piece into the slot'}
      </p>
      <motion.div
        ref={trackRef}
        animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : {}}
        transition={{ duration: 0.35 }}
        className={`relative h-12 rounded-xl border transition-colors duration-300 overflow-hidden ${verified ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-slate-900/40'
          }`}
      >
        {/* target slot outline */}
        {targetX !== null && !verified && (
          <div
            className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ left: targetX, width: pieceSize, height: pieceSize }}
          >
            <div className="w-full h-full rounded-md border-2 border-dashed border-white/20" />
            <div className="absolute -left-2 w-4 h-4 rounded-full border-2 border-dashed border-white/20 bg-[#02050A]" />
          </div>
        )}

        {/* draggable piece */}
        <motion.div
          drag={verified ? false : 'x'}
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0.05}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ x, y: '-50%', top: '50%', width: pieceSize, height: pieceSize }}
          whileDrag={{ scale: 1.05 }}
          className={`absolute flex items-center justify-center rounded-md shadow-lg cursor-grab active:cursor-grabbing select-none ${verified ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
        >
          <div className={`absolute -left-2 w-4 h-4 rounded-full ${verified ? 'bg-emerald-500' : 'bg-blue-500'}`} />
          {verified ? <CheckCircle2 className="w-5 h-5 text-white" /> : <ShieldCheck className="w-4 h-4 text-white" />}
        </motion.div>
      </motion.div>
    </div>
  );
};

/** Small reusable "resend in Ns" control used by OTP + forgot-password screens. */
const ResendTimer = ({ onResend }: { onResend: () => void }) => {
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  return seconds > 0 ? (
    <span className="text-slate-500">Resend in {seconds}s</span>
  ) : (
    <button
      type="button"
      onClick={() => { onResend(); setSeconds(30); }}
      className="text-blue-400 hover:text-blue-300 font-medium transition-colors inline-flex items-center gap-1"
    >
      <RefreshCcw className="w-3 h-3" /> Resend code
    </button>
  );
};

/* ------------------------------------------------------------------ */
/*  Login (credentials -> OTP)                                        */
/* ------------------------------------------------------------------ */

const LoginForm = ({ onSwitchToSignup, onSwitchToForgot }: { onSwitchToSignup: () => void; onSwitchToForgot: () => void }) => {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        alert('Logged in successfully! Welcome ' + data.user.name);
        window.location.href = "/";
      }
    } catch (err) {
      setError('Network error. Is the backend running?');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      await mockVerifyOtp(otp);
    } catch {
      setError('That code didn\'t match. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/^(.{2}).+(@.+)$/, '$1***$2')
    : 'your email';

  return (
    <div className="flex flex-col h-auto w-full max-w-[390px] mx-auto justify-center rounded-[2rem] border border-white/15 bg-white/10 backdrop-blur-2xl px-8 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
      <motion.div
        initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -15, filter: 'blur(10px)' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <span className="font-sans font-bold text-xl text-white tracking-tight">Amanzi</span>
        </div>

        {step === 'credentials' ? (
          <>
            <h2 className="text-[32px] font-bold text-white mb-2 tracking-tight leading-tight">Welcome back</h2>
            <p className="text-slate-400 text-sm">Sign in to continue to your account</p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep('credentials')}
              className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-200 mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h2 className="text-[32px] font-bold text-white mb-2 tracking-tight leading-tight">Check your inbox</h2>
            <p className="text-slate-400 text-sm">Enter the 6-digit code sent to <span className="text-slate-300">{maskedEmail}</span></p>
          </>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'credentials' ? (
          <motion.form
            key="credentials"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
            onSubmit={handleCredentialsSubmit}
          >
            <FormInput icon={Mail} type="email" placeholder="Enter your email" label="Email address" delay={0.05} value={email} onChange={setEmail} />
            <FormInput icon={Lock} type="password" placeholder="Enter your password" label="Password" delay={0.1} value={password} onChange={setPassword} />

            {error && <p className="text-[13px] text-red-400 font-medium ml-1">{error}</p>}

            <div className="flex justify-between items-center pt-1 pb-2">
              <label className="flex items-center gap-2 text-[13px] text-slate-400 cursor-pointer group" onClick={() => setRememberMe(!rememberMe)}>
                <div className={`relative w-4 h-4 rounded border transition-colors flex items-center justify-center ${rememberMe ? 'bg-blue-500 border-blue-500' : 'border-white/10 bg-slate-900/50 group-hover:border-blue-500/50'}`}>
                  {rememberMe && <Check className="w-3 h-3 text-white" />}
                </div>
                Remember me
              </label>
              <button
                type="button"
                onClick={onSwitchToForgot}
                className="text-[13px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <motion.button
              layoutId="auth-submit-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={sending || !rememberMe || !email || !password}
              className="w-full relative group overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] mt-2"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </span>
            </motion.button>
          </motion.form>
        ) : (
          <motion.form
            key="otp"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            className="space-y-5"
            onSubmit={handleVerifyOtp}
          >
            <OtpInput value={otp} onChange={setOtp} />
            {error && <p className="text-[13px] text-red-400 ml-1">{error}</p>}

            <div className="text-[13px] text-slate-400">
              <ResendTimer onResend={() => mockSendOtp(email)} />
            </div>

            <motion.button
              layoutId="auth-submit-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={otp.length < 6 || verifying}
              className="w-full relative group overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] mt-2"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & sign in <ArrowRight className="w-4 h-4" /></>}
              </span>
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.3 }}
        className="mt-8 text-center text-[13px] text-slate-400"
      >
        Don't have an account?{' '}
        <button type="button" onClick={onSwitchToSignup} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
          Create one now
        </button>
      </motion.div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Forgot password                                                    */
/* ------------------------------------------------------------------ */

const ForgotPasswordForm = ({ onSwitchToLogin }: { onSwitchToLogin: () => void }) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await mockSendResetEmail(email);
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-auto w-full max-w-[390px] mx-auto justify-center rounded-[2rem] border border-white/15 bg-white/10 backdrop-blur-2xl px-8 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
      <motion.div
        initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -15, filter: 'blur(10px)' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <span className="font-sans font-bold text-xl text-white tracking-tight">Amanzi</span>
        </div>

        <button
          type="button"
          onClick={onSwitchToLogin}
          className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-200 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </button>

        {!sent ? (
          <>
            <h2 className="text-[32px] font-bold text-white mb-2 tracking-tight leading-tight">Reset password</h2>
            <p className="text-slate-400 text-sm">We'll email you a link to get back into your account</p>
          </>
        ) : (
          <>
            <h2 className="text-[32px] font-bold text-white mb-2 tracking-tight leading-tight">Link sent</h2>
            <p className="text-slate-400 text-sm">Check <span className="text-slate-300">{email || 'your inbox'}</span> for a reset link</p>
          </>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.form
            key="request"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
            onSubmit={handleSubmit}
          >
            <div className="space-y-1.5 w-full">
              <label className="text-[13px] text-slate-300 font-medium ml-1 tracking-wide">Email address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-blue-400 transition-colors duration-300" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/5 focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-blue-500/50 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-all duration-300 outline-none shadow-inner"
                  placeholder="Enter your account email"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={sending}
              className="w-full relative group overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] mt-2"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send reset link <KeyRound className="w-4 h-4" /></>}
              </span>
            </motion.button>
          </motion.form>
        ) : (
          <motion.div
            key="confirmation"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              If an account exists for that email, a reset link is on its way.
            </div>
            <div className="text-[13px] text-slate-400 text-center">
              Didn't get it? <ResendTimer onResend={() => mockSendResetEmail(email)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Signup (with slide-puzzle captcha gate)                            */
/* ------------------------------------------------------------------ */

const SignupForm = ({ onSwitch }: { onSwitch: () => void }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'details' | 'captcha'>('details');
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [creating, setCreating] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Moving to the captcha step doesn't add height to the card — it
  // replaces the form fields rather than stacking below them, so the
  // card never grows taller than the viewport.
  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('captcha');
  };

  const handleFinalSubmit = async () => {
    setCreating(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Signup failed');
      } else {
        alert('Account created successfully! Please log in.');
        onSwitch();
      }
    } catch (err) {
      alert('Network error. Is the backend running?');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-auto w-full max-w-[370px] mx-auto justify-center rounded-[1.75rem] border border-white/15 bg-white/10 backdrop-blur-2xl px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
      <motion.div
        initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -15, filter: 'blur(10px)' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-5"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <span className="font-sans font-bold text-xl text-white tracking-tight">Amanzi</span>
        </div>

        {step === 'details' ? (
          <>
            <h2 className="text-[30px] font-bold text-white mb-1 tracking-tight leading-tight">
              Create Account
            </h2>
            <p className="text-slate-400 text-sm">Join us and start estimating costs fast.</p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep('details')}
              className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-200 mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h2 className="text-[30px] font-bold text-white mb-1 tracking-tight leading-tight">
              One quick check
            </h2>
            <p className="text-slate-400 text-sm">Slide the piece into place to confirm you're human.</p>
          </>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'details' ? (
          <motion.form
            key="details"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
            onSubmit={handleDetailsSubmit}
          >
            <div className="rounded-[1.35rem] border border-white/15 bg-white/10 backdrop-blur-xl px-5 py-5 space-y-3">
              <FormInput icon={User} type="text" placeholder="John Doe" label="Full Name" delay={0.05} value={name} onChange={setName} />
              <FormInput icon={Mail} type="email" placeholder="Enter your email" label="Email address" delay={0.1} value={email} onChange={setEmail} />
              <FormInput icon={Lock} type="password" placeholder="Create a password" label="Password" delay={0.15} value={password} onChange={setPassword} />

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 pt-1"
              >
                <label className="flex items-center gap-2 text-[12px] text-slate-400 cursor-pointer group" onClick={() => setAgreed(!agreed)}>
                  <div className={`relative w-4 h-4 rounded border transition-colors flex items-center justify-center ${agreed ? 'bg-white border-white' : 'border-white/10 bg-slate-900/50 group-hover:border-white/30'}`}>
                    {agreed && <Check className="w-3 h-3 text-[#030811]" />}
                  </div>
                  I agree to the Terms & Conditions
                </label>
              </motion.div>
            </div>

            <motion.button
              disabled={!agreed || !name || !email || !password}
              layoutId="auth-submit-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.25 }}
              className="w-full relative group overflow-hidden bg-white text-[#030811] disabled:opacity-50 hover:bg-slate-200 disabled:hover:bg-white font-bold text-[15px] py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Sign up <ArrowRight className="w-4 h-4" />
              </span>
            </motion.button>
          </motion.form>
        ) : (
          <motion.div
            key="captcha"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.35 }}
            className="space-y-5"
          >
            <div className="rounded-[1.1rem] border border-white/15 bg-white/5 px-4 py-4">
              <SlideCaptcha verified={captchaVerified} onVerify={setCaptchaVerified} />
            </div>

            <motion.button
              layoutId="auth-submit-btn"
              whileHover={{ scale: captchaVerified ? 1.02 : 1 }}
              whileTap={{ scale: captchaVerified ? 0.98 : 1 }}
              onClick={handleFinalSubmit}
              disabled={!captchaVerified || creating}
              className="w-full relative group overflow-hidden bg-white text-[#030811] hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white font-bold text-[15px] py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirm & create account <ArrowRight className="w-4 h-4" /></>}
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-5 text-center text-[13px] text-slate-400"
      >
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-white hover:text-slate-200 font-medium transition-colors">
          Sign in instead
        </button>
      </motion.div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Top-level switcher                                                 */
/* ------------------------------------------------------------------ */

type View = 'login' | 'signup' | 'forgot';

const panelCopy: Record<View, { badge: string; title: string; body: string }> = {
  login: {
    badge: 'Secure Gateway',
    title: 'AI-Powered Costing Engine',
    body: 'Experience zero friction data extraction and generate instant, accurate cost estimates natively from complex engineering drawings.',
  },
  signup: {
    badge: 'Secure Gateway',
    title: 'Built for Estimators',
    body: 'Create an account to start turning engineering drawings into accurate, instant cost estimates.',
  },
  forgot: {
    badge: 'Account Recovery',
    title: "We've Got You",
    body: 'Password resets are quick — confirm your email and you\'ll be back in within minutes.',
  },
};

export default function AuthSwitcher({ initialView = 'login' }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const isLogin = view !== 'signup';

// unused animation values removed to satisfy strict tsconfig

  const copy = panelCopy[view];

  return (
    <div className="h-screen w-full relative flex items-center justify-center overflow-hidden bg-[#02050A] text-slate-200 font-sans selection:bg-blue-500/30">

      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-20"
          animate={{
            background: isLogin
              ? 'radial-gradient(circle, rgba(37,99,235,1) 0%, rgba(2,5,10,0) 70%)'
              : 'radial-gradient(circle, rgba(139,92,246,1) 0%, rgba(2,5,10,0) 70%)',
            x: isLogin ? '20%' : '80%',
            y: '10%'
          }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <div className="w-full h-full relative overflow-hidden bg-[#00102a]/20 backdrop-blur-[40px] flex flex-col md:flex-row">
          <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-black/40 pointer-events-none" />

          <div className={`absolute inset-0 flex flex-col md:flex-row ${!isLogin ? 'md:flex-row-reverse' : ''}`}>

            <motion.div
              layout
              transition={{ type: 'spring', bounce: 0.15, duration: 0.8 }}
              className="w-full md:w-1/2 h-full relative z-20 flex items-center justify-center p-8"
            >
              <AnimatePresence mode="wait">
                {view === 'login' && (
                  <LoginForm
                    key="login"
                    onSwitchToSignup={() => setView('signup')}
                    onSwitchToForgot={() => setView('forgot')}
                  />
                )}
                {view === 'signup' && (
                  <SignupForm key="signup" onSwitch={() => setView('login')} />
                )}
                {view === 'forgot' && (
                  <ForgotPasswordForm key="forgot" onSwitchToLogin={() => setView('login')} />
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              layout
              transition={{ type: 'spring', bounce: 0.15, duration: 0.8 }}
              className="hidden md:flex w-full md:w-1/2 h-full relative z-30"
            >
              <div className="w-full h-full overflow-hidden relative border-x border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover mix-blend-lighten opacity-80">
                  <source src="/assets/animation/login.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-[#02050A] via-[#02050A]/20 to-transparent" />
                <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" />

                <div className="absolute bottom-16 left-16 right-16">
                  <motion.div layout className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-4">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-medium text-white tracking-wider uppercase">{copy.badge}</span>
                  </motion.div>
                  <motion.h3 layout className="text-white font-bold text-3xl mb-3 tracking-tight">{copy.title}</motion.h3>
                  <motion.p layout className="text-slate-300 text-sm leading-relaxed max-w-sm">
                    {copy.body}
                  </motion.p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}

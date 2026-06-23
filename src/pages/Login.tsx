import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Eye, Lock, Mail, User, ArrowRight, Shield, Hexagon } from 'lucide-react';

const FormInput = ({ icon: Icon, type, placeholder, label, delay }: { icon: any, type: string, placeholder: string, label: string, delay: number }) => (
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
        type={type}
        className="w-full bg-slate-900/40 border border-white/5 focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-blue-500/50 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 transition-all duration-300 outline-none shadow-inner"
        placeholder={placeholder}
      />
      {type === 'password' && (
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer">
          <Eye className="h-4 w-4 text-slate-400 hover:text-slate-200 transition-colors" />
        </div>
      )}
      <div className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 ring-1 ring-blue-500/30 blur-[2px] transition-opacity duration-300 pointer-events-none" />
    </div>
  </motion.div>
);

const LoginForm = ({ onSwitch }: { onSwitch: () => void }) => {
  return (
    <div className="flex flex-col h-full w-full max-w-[340px] mx-auto justify-center">
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
        <h2 className="text-[32px] font-bold text-white mb-2 tracking-tight leading-tight">Welcome back</h2>
        <p className="text-slate-400 text-sm">Sign in to continue to your account</p>
      </motion.div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <FormInput icon={Mail} type="email" placeholder="Enter your email" label="Email address" delay={0.1} />
        <FormInput icon={Lock} type="password" placeholder="Enter your password" label="Password" delay={0.15} />

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: 0.2 }}
          className="flex justify-between items-center pt-1 pb-2"
        >
          <label className="flex items-center gap-2 text-[13px] text-slate-400 cursor-pointer group">
            <div className="relative w-4 h-4 rounded border border-white/10 bg-slate-900/50 group-hover:border-blue-500/50 transition-colors flex items-center justify-center" />
            Remember me
          </label>
          <a href="#" className="text-[13px] text-blue-400 hover:text-blue-300 transition-colors">Forgot password?</a>
        </motion.div>

        <motion.button
          layoutId="auth-submit-btn"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: 0.25 }}
          className="w-full relative group overflow-hidden bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] mt-2"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">Sign in <ArrowRight className="w-4 h-4" /></span>
        </motion.button>
      </form>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.3 }}
        className="mt-8 text-center text-[13px] text-slate-400"
      >
        Don't have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
          Create one now
        </button>
      </motion.div>
    </div>
  );
};

const SignupForm = ({ onSwitch }: { onSwitch: () => void }) => {
  return (
    <div className="flex flex-col h-full w-full max-w-[340px] mx-auto justify-center">
      <motion.div
        initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -15, filter: 'blur(10px)' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <span className="font-sans font-bold text-xl text-white tracking-tight">Amanzi</span>
        </div>
        <h2 className="text-[32px] font-bold text-white mb-2 tracking-tight leading-tight">Create Account</h2>
        <p className="text-slate-400 text-sm">Join us and start estimating costs fast.</p>
      </motion.div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <FormInput icon={User} type="text" placeholder="John Doe" label="Full Name" delay={0.05} />
        <FormInput icon={Mail} type="email" placeholder="Enter your email" label="Email address" delay={0.1} />
        <FormInput icon={Lock} type="password" placeholder="Create a password" label="Password" delay={0.15} />

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: 0.2 }}
          className="flex items-center gap-2 pt-1 pb-2"
        >
          <label className="flex items-center gap-2 text-[13px] text-slate-400 cursor-pointer group">
            <div className="relative w-4 h-4 rounded border border-white/10 bg-slate-900/50 group-hover:border-white/30 transition-colors flex items-center justify-center" />
            I agree to the Terms & Conditions
          </label>
        </motion.div>

        <motion.button
          layoutId="auth-submit-btn"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: 0.25 }}
          className="w-full relative group overflow-hidden bg-white text-[#030811] hover:bg-slate-200 font-bold text-[15px] py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] mt-2"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">Sign up <ArrowRight className="w-4 h-4" /></span>
        </motion.button>
      </form>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.3 }}
        className="mt-8 text-center text-[13px] text-slate-400"
      >
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-white hover:text-slate-200 font-medium transition-colors">
          Sign in instead
        </button>
      </motion.div>
    </div>
  );
};

export default function AuthSwitcher() {
  const [isLogin, setIsLogin] = useState(true);

  // 3D Tilt Effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { currentTarget, clientX, clientY } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = (clientX - left - width / 2) / (width / 2);
    const y = (clientY - top - height / 2) / (height / 2);
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const rotateX = useSpring(useTransform(mouseY, [-1, 1], [5, -5]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-1, 1], [-5, 5]), { stiffness: 150, damping: 20 });

  return (
    <div className="h-screen w-full relative flex items-center justify-center overflow-hidden bg-[#02050A] text-slate-200 font-sans selection:bg-blue-500/30">

      {/* Background Ambient Effects */}
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
          {/* Inner Glow Highlights */}
          <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-black/40 pointer-events-none" />

          {/* Dynamic layout wrapper that reverses on state change */}
          <div className={`absolute inset-0 flex flex-col md:flex-row ${!isLogin ? 'md:flex-row-reverse' : ''}`}>

            {/* Form Container (Fixed Size, Animates Left/Right) */}
            <motion.div
              layout
              transition={{ type: 'spring', bounce: 0.15, duration: 0.8 }}
              className="w-full md:w-1/2 h-full relative z-20 flex items-center justify-center p-8"
            >
              <AnimatePresence mode="wait">
                {isLogin ? (
                  <LoginForm key="login" onSwitch={() => setIsLogin(false)} />
                ) : (
                  <SignupForm key="signup" onSwitch={() => setIsLogin(true)} />
                )}
              </AnimatePresence>
            </motion.div>

            {/* Visual Panel (Animates Right/Left overlaying the other side) */}
            <motion.div
              layout
              transition={{ type: 'spring', bounce: 0.15, duration: 0.8 }}
              className="hidden md:flex w-full md:w-1/2 h-full relative z-30"
            >
              <div className="w-full h-full overflow-hidden relative border-x border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                {/* Visual Content: Video with Overlay */}
                <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover mix-blend-lighten opacity-80">
                  <source src="/assets/animation/login.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-[#02050A] via-[#02050A]/20 to-transparent" />
                <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" />

                {/* Visual Panel Decorative Elements */}
                <div className="absolute bottom-16 left-16 right-16">
                  <motion.div layout className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-4">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-medium text-white tracking-wider uppercase">Secure Gateway</span>
                  </motion.div>
                  <motion.h3 layout className="text-white font-bold text-3xl mb-3 tracking-tight">AI-Powered Costing Engine</motion.h3>
                  <motion.p layout className="text-slate-300 text-sm leading-relaxed max-w-sm">
                    Experience zero friction data extraction and generate instant, accurate cost estimates natively from complex engineering drawings.
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

/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Shield, Loader2 } from 'lucide-react';

type AuthStep = 'choose' | 'email_input' | 'otp_verify';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithOtp, verifyOtp } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<AuthStep>('choose');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (user) router.push('/');
  }, [user, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);

    const { error: otpError } = await signInWithOtp(email.trim().toLowerCase());
    setLoading(false);

    if (otpError) {
      setError(otpError);
    } else {
      setStep('otp_verify');
      setCountdown(60);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setError(null);
    setLoading(true);

    const { error: verifyError } = await verifyOtp(email.trim().toLowerCase(), otpCode);
    setLoading(false);

    if (verifyError) {
      setError(verifyError);
    }
    // On success, the auth state change listener in AuthProvider will redirect
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError(null);
    setLoading(true);
    const { error: otpError } = await signInWithOtp(email.trim().toLowerCase());
    setLoading(false);
    if (otpError) {
      setError(otpError);
    } else {
      setCountdown(60);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-main)] font-body overflow-hidden">
      <header className="px-4 pt-10 pb-4 z-10 sticky top-0">
        <button
          onClick={() => {
            if (step === 'otp_verify') { setStep('email_input'); setOtpCode(''); setError(null); }
            else if (step === 'email_input') { setStep('choose'); setError(null); }
            else router.push('/');
          }}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-[var(--border-light)] hover:bg-[var(--bg-subtle)] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-[var(--text-body)]" />
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 pb-20 animate-fade-in">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          
          {/* Logo */}
          <div className="w-28 h-28 flex items-center justify-center mb-6 relative">
            <img 
              src="/pawloop-logo-icon.png" 
              alt="PawLoop Logo" 
              className="w-full h-full object-contain"
            />
          </div>

          <h1 className="font-heading text-3xl font-bold text-[var(--text-heading)] tracking-tight mb-2">
            PawLoop
          </h1>
          <p className="text-sm text-[var(--text-body)] max-w-[260px] leading-relaxed mb-10">
            {step === 'otp_verify'
              ? `Enter the 6-digit code sent to ${email}`
              : 'Join the urban animal welfare network.'
            }
          </p>

          {/* Error Display */}
          {error && (
            <div className="w-full mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 font-medium text-left animate-fade-in">
              {error}
            </div>
          )}

          {/* ─── Step: Choose Method ─── */}
          {step === 'choose' && (
            <div className="w-full space-y-3">
              {/* Email OTP — Primary */}
              <button
                onClick={() => { setStep('email_input'); setError(null); }}
                className="w-full h-14 bg-[var(--accent-primary)] text-white rounded-2xl shadow-sm flex items-center justify-center gap-3 font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <Mail size={20} />
                Continue with Email
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-[var(--border-light)]" />
                <span className="text-[10px] text-[var(--text-body)] font-semibold uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-[var(--border-light)]" />
              </div>

              {/* Google — Secondary */}
              <button
                onClick={signInWithGoogle}
                className="w-full h-14 bg-white rounded-2xl shadow-sm border border-[var(--border-light)] flex items-center justify-center gap-3 font-semibold text-[var(--text-heading)] hover:bg-[var(--bg-subtle)] active:scale-[0.98] transition-all"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>
          )}

          {/* ─── Step: Email Input ─── */}
          {step === 'email_input' && (
            <div className="w-full space-y-4">
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
                  placeholder="your@email.com"
                  autoFocus
                  className="w-full h-14 pl-12 pr-4 bg-white border border-[var(--border-light)] rounded-2xl text-sm text-[var(--text-heading)]
                             placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40 focus:border-[var(--accent-primary)]"
                />
              </div>
              <button
                onClick={handleSendOtp}
                disabled={loading || !email.trim()}
                className="w-full h-14 bg-[var(--accent-primary)] text-white rounded-2xl font-semibold
                           hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Shield size={18} />}
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </div>
          )}

          {/* ─── Step: OTP Verification ─── */}
          {step === 'otp_verify' && (
            <div className="w-full space-y-4">
              <div className="relative">
                <Shield size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
                  placeholder="000000"
                  autoFocus
                  className="w-full h-14 pl-12 pr-4 bg-white border border-[var(--border-light)] rounded-2xl text-center text-2xl font-mono font-bold tracking-[0.5em] text-[var(--text-heading)]
                             placeholder:text-gray-300 placeholder:tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40 focus:border-[var(--accent-primary)]"
                />
              </div>
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.length < 6}
                className="w-full h-14 bg-[var(--accent-primary)] text-white rounded-2xl font-semibold
                           hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : null}
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              {/* Resend */}
              <button
                onClick={handleResend}
                disabled={countdown > 0 || loading}
                className="text-xs text-[var(--text-body)] font-semibold hover:text-[var(--accent-primary)] transition-colors disabled:opacity-50"
              >
                {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
              </button>
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-8 max-w-[260px] leading-relaxed">
            By continuing, you agree to help keep our community safe and accountable for animal welfare.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message === 'User already registered'
        ? '이미 가입된 이메일입니다.'
        : authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-6">
        <div className="text-center max-w-[440px]">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2">
              <path d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7"/>
              <path d="M2 13l10 8 10-8"/>
            </svg>
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">
            이메일을 확인해주세요
          </h2>
          <p className="text-[var(--text-muted)] text-[0.9375rem] leading-relaxed">
            <span className="text-[var(--accent-light)] font-medium">{email}</span>로<br />
            인증 링크를 보냈습니다.
          </p>
          <Link href="/auth/login" className="inline-block mt-8 py-3 px-8 rounded-xl border border-white/10 text-white/70 no-underline text-sm">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[var(--bg-base)]">
      {/* 브랜딩 */}
      <div className="hidden md:flex flex-col justify-center p-16 bg-gradient-to-br from-[var(--bg-raised)] via-[var(--bg-elevated)] to-[var(--bg-raised)] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(91,140,110,0.15)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[60px] -left-[60px] w-60 h-60 rounded-full bg-[radial-gradient(circle,rgba(110,170,128,0.12)_0%,transparent_70%)]" />
        <div className="relative z-10">
          <div className="text-[0.8rem] tracking-[0.15em] text-[var(--accent-bright)]/70 uppercase mb-4">HLB 보컬스튜디오</div>
          <h1 className="text-[2.5rem] font-extrabold text-white leading-[1.2] mb-6">
            목소리의 변화를,<br />
            <span className="text-[var(--accent-light)]">직접 느껴보세요</span>
          </h1>
          <p className="text-base text-white/[0.55] leading-[1.7] max-w-[360px]">
            18단계까지 무료. 신용카드 불필요.<br />
            AI 코치와 함께 지금 바로 시작하세요.
          </p>

          <div className="mt-12 p-6 rounded-xl bg-white/[0.04] border border-white/[0.07]">
            <div className="text-xs tracking-[0.08em] text-white/[0.35] uppercase mb-4">
              무료 플랜 포함
            </div>
            {[
              '18단계 레슨 채점 진행',
              'AI 발성 4축 분석',
              '스케일 피아노 자율 연습',
              '기본 긴장 감지',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 mb-2.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <circle cx="8" cy="8" r="7.5" stroke="rgba(91,140,110,0.4)" />
                  <path d="M5 8l2 2 4-4" stroke="var(--accent-light)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm text-white/65">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div className="flex flex-col justify-start pt-16 md:justify-center items-center px-6 md:p-16">
        <div className="w-full max-w-full md:max-w-[380px]">
          <h2 className="text-[1.75rem] font-bold text-white mb-2">무료로 시작하기</h2>
          <p className="text-sm text-[var(--text-muted)] mb-8">계정을 만들면 바로 레슨을 시작합니다</p>

          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                이름
              </label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] outline-none focus:border-[var(--accent)]/60 transition-colors"
                placeholder="홍길동"
              />
            </div>

            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                이메일
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] outline-none focus:border-[var(--accent)]/60 transition-colors"
                placeholder="vocal@example.com"
              />
            </div>

            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                비밀번호
              </label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] outline-none focus:border-[var(--accent)]/60 transition-colors"
                placeholder="6자 이상"
              />
            </div>

            {error && (
              <div className="py-3 px-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className={`w-full py-3.5 rounded-xl border-none text-white text-[0.9375rem] font-semibold mt-1 transition-colors ${
                loading
                  ? 'bg-[var(--bg-elevated)] cursor-not-allowed'
                  : 'bg-[var(--accent)] cursor-pointer hover:bg-[var(--accent-hover)]'
              }`}
            >
              {loading ? '가입 중...' : '무료로 시작하기'}
            </button>
          </form>

          <p className="text-center mt-6 text-[var(--text-muted)] text-sm">
            이미 계정이 있으신가요?{' '}
            <Link href="/auth/login" className="text-[var(--accent-light)] no-underline font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

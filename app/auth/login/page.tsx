'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/journey';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : authError.message);
      setLoading(false);
      return;
    }

    router.push(nextPath.startsWith('/') ? nextPath : '/journey');
    router.refresh();
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[var(--bg-base)]">
      {/* 브랜딩 */}
      <div className="hidden md:flex flex-col justify-center p-16 bg-gradient-to-br from-[var(--bg-raised)] via-[var(--bg-elevated)] to-[var(--bg-raised)] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(91,140,110,0.15)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[60px] -left-[60px] w-60 h-60 rounded-full bg-[radial-gradient(circle,rgba(110,170,128,0.12)_0%,transparent_70%)]" />
        <div className="relative z-10">
          <div className="text-[0.8rem] tracking-[0.15em] text-[var(--accent-bright)]/70 uppercase mb-4">HLB 보컬스튜디오</div>
          <h1 className="text-[2.5rem] font-extrabold text-white leading-[1.2] mb-6">
            목이 조이는 이유,<br />
            <span className="text-[var(--accent-light)]">이제 알 수 있습니다</span>
          </h1>
          <p className="text-base text-white/[0.55] leading-[1.7] max-w-[360px]">
            후두·혀뿌리·턱의 긴장을 AI가 실시간으로 분석하고,
            당신만의 발성 로드맵을 제시합니다.
          </p>

          <div className="mt-12 flex flex-col gap-4">
            {[
              { label: '28단계', desc: '체계적 커리큘럼' },
              { label: '4축 분석', desc: '후두·혀뿌리·턱·성구' },
              { label: '18단계 무료', desc: '신용카드 불필요' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-[10px] shrink-0 bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-xs font-bold text-[var(--accent-light)]">
                  {item.label.replace(/[가-힣·]/g, '').trim() || item.label.slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="text-xs text-white/40">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div className="flex flex-col justify-start pt-16 md:justify-center items-center px-6 md:p-16">
        <div className="w-full max-w-[380px] md:max-w-[380px]">
          <h2 className="text-[1.75rem] font-bold text-white mb-2">로그인</h2>
          <p className="text-sm text-[var(--text-muted)] mb-8">계속하려면 로그인하세요</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] outline-none focus:border-[var(--accent)]/60 transition-colors"
                placeholder="vocal@example.com"
              />
            </div>

            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl border-none text-white text-[0.9375rem] font-semibold mt-1 transition-colors ${
                loading
                  ? 'bg-[var(--bg-elevated)] cursor-not-allowed'
                  : 'bg-[var(--accent)] cursor-pointer hover:bg-[var(--accent-hover)]'
              }`}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="text-center mt-6 text-[var(--text-muted)] text-sm">
            계정이 없으신가요?{' '}
            <Link href="/auth/signup" className="text-[var(--accent-light)] no-underline font-medium">
              무료로 시작하기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { User } from '@supabase/supabase-js';

export default function Nav() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => { window.removeEventListener('scroll', onScroll); subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
    router.refresh();
  };

  const closeMenu = () => setMenuOpen(false);

  const navLinkClass = 'px-2.5 py-2 text-[var(--text2)] no-underline text-[0.82rem] font-normal rounded-lg transition-colors hover:text-[var(--text)] hover:bg-[var(--surface2)] whitespace-nowrap';
  const mobileLinkClass = "font-['Inter',sans-serif] text-[1.6rem] font-bold text-[var(--text)] no-underline transition-colors hover:text-[var(--accent)]";
  const ctaClass = '!px-6 !py-2.5 !bg-[var(--cta-bg)] !text-[var(--cta-text)] !font-semibold !rounded-[10px] !transition-all !shadow-[0_4px_20px_rgba(255,255,255,0.1)] hover:!-translate-y-px hover:!shadow-[0_8px_28px_rgba(255,255,255,0.15)] hover:!bg-[var(--cta-hover)]';

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[200] py-5 bg-[var(--glass-bg)]/30 backdrop-blur-[8px] transition-all duration-[400ms] border-b border-transparent ${
          scrolled ? 'py-3.5 !bg-[var(--glass-bg)] !backdrop-blur-[30px] saturate-[180%] !border-[var(--border)]' : ''
        }`}
        id="mainNav"
      >
        <div className="max-w-[1200px] mx-auto px-7 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-['Inter',sans-serif] text-[1.1rem] font-medium text-[var(--text)] no-underline tracking-[-0.01em]">
            <div className="w-10 h-10 bg-gradient-to-br from-[#3B82F6] to-[#7C3AED] rounded-xl flex items-center justify-center relative overflow-hidden shadow-[0_4px_16px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]">
              <svg className="relative z-[1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="url(#lgr)" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="12" y1="19" x2="12" y2="22" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <defs>
                  <linearGradient id="lgr" x1="9" y1="2" x2="15" y2="12">
                    <stop stopColor="#fff" />
                    <stop offset="1" stopColor="rgba(255,255,255,0.6)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="flex gap-[5px]"><strong className="font-extrabold tracking-[0.02em] bg-gradient-to-br from-[#60A5FA] to-[#A78BFA] bg-clip-text text-transparent">HLB</strong> 보컬스튜디오</span>
          </Link>

          <ul className="hidden min-[960px]:flex items-center gap-2 list-none flex-nowrap overflow-hidden">
            <li><Link href="/journey" className={navLinkClass}>소리의 길</Link></li>
            <li><Link href="/scale-practice" className={navLinkClass}>스케일 연습</Link></li>
            <li><Link href="/coach" className={navLinkClass}>AI 코치</Link></li>
            <li><Link href="/ai-cover" className={navLinkClass}>AI 커버</Link></li>
            <li><Link href="/vocal-report" className={navLinkClass}>발성 분석</Link></li>
            <li><Link href="/pricing" className={navLinkClass}>요금제</Link></li>
            {user && <li><Link href="/dashboard" className={navLinkClass}>대시보드</Link></li>}
            <li><ThemeToggle /></li>
            {user ? (
              <li><button onClick={handleLogout} className={`${ctaClass} border-none cursor-pointer`}>로그아웃</button></li>
            ) : (
              <li><Link href="/onboarding" className={`${ctaClass} no-underline`}>무료 시작</Link></li>
            )}
          </ul>

          <button
            className="flex min-[960px]:hidden flex-col gap-[5px] cursor-pointer p-1.5 bg-transparent border-none"
            onClick={() => setMenuOpen(true)}
            aria-label="메뉴 열기"
          >
            <span className="block w-[22px] h-[1.5px] bg-[var(--text)] rounded-sm transition-all" />
            <span className="block w-[22px] h-[1.5px] bg-[var(--text)] rounded-sm transition-all" />
            <span className="block w-[22px] h-[1.5px] bg-[var(--text)] rounded-sm transition-all" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 z-[300] bg-[var(--bg-base)]/97 backdrop-blur-[24px] flex-col items-center justify-center gap-[22px] ${
          menuOpen ? 'flex' : 'hidden'
        }`}
        role="dialog"
        aria-modal="true"
      >
        <button className="absolute top-[22px] right-[26px] bg-transparent border-none text-[var(--muted)] text-2xl cursor-pointer" onClick={closeMenu} aria-label="메뉴 닫기">✕</button>
        <Link href="/journey" onClick={closeMenu} className={mobileLinkClass}>소리의 길</Link>
        <Link href="/scale-practice" onClick={closeMenu} className={mobileLinkClass}>스케일 연습</Link>
        <Link href="/coach" onClick={closeMenu} className={mobileLinkClass}>AI 코치</Link>
        <Link href="/ai-cover" onClick={closeMenu} className={mobileLinkClass}>AI 커버</Link>
        <Link href="/vocal-report" onClick={closeMenu} className={mobileLinkClass}>발성 분석</Link>
        <Link href="/pricing" onClick={closeMenu} className={mobileLinkClass}>요금제</Link>
        {user && <Link href="/dashboard" onClick={closeMenu} className={mobileLinkClass}>대시보드</Link>}
        {user ? (
          <button onClick={() => { closeMenu(); handleLogout(); }} className="bg-transparent border-none cursor-pointer text-[var(--text)] font-['Inter',sans-serif] text-[1.6rem] font-bold p-0 text-left transition-colors hover:text-[var(--accent)]">로그아웃</button>
        ) : (
          <Link href="/onboarding" onClick={closeMenu} className={mobileLinkClass}>무료 시작</Link>
        )}
      </div>
    </>
  );
}

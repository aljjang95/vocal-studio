'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './Nav.module.css';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`} id="mainNav">
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark}>
              <svg className={styles.logoIcon} width="22" height="22" viewBox="0 0 24 24" fill="none">
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
            <span className={styles.logoLabel}><strong>HLB</strong> 보컬스튜디오</span>
          </Link>

          <ul className={styles.navLinks}>
            <li><a href="#features">기능</a></li>
            <li><a href="#how">사용법</a></li>
            <li><a href="#demo">AI 체험</a></li>
            <li><a href="#pricing">요금제</a></li>
            <li><Link href="/practice">연습실</Link></li>
            <li><Link href="/coach">AI 코치</Link></li>
            <li><Link href="/breathing">호흡</Link></li>
            <li><a href="/diagnosis" className={styles.navCta}>무료 시작</a></li>
          </ul>

          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(true)}
            aria-label="메뉴 열기"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.open : ''}`} role="dialog" aria-modal="true">
        <button className={styles.mClose} onClick={closeMenu} aria-label="메뉴 닫기">✕</button>
        <a href="#features" onClick={closeMenu}>기능</a>
        <a href="#how" onClick={closeMenu}>사용법</a>
        <a href="#demo" onClick={closeMenu}>AI 체험</a>
        <a href="#pricing" onClick={closeMenu}>요금제</a>
        <Link href="/practice" onClick={closeMenu}>연습실</Link>
        <Link href="/coach" onClick={closeMenu}>AI 코치</Link>
        <Link href="/breathing" onClick={closeMenu}>호흡</Link>
        <a href="/diagnosis" onClick={closeMenu}>무료로 시작하기 →</a>
      </div>
    </>
  );
}

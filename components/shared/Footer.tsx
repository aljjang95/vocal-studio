import Link from 'next/link';
import { IconYoutube, IconInstagram, IconTiktok, IconTwitter } from '@/components/shared/Icons';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.logo}>
              <div className={styles.logoMark}>
                <svg className={styles.logoIcon} width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="url(#flgr)" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12" y1="19" x2="12" y2="22" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="flgr" x1="9" y1="2" x2="15" y2="12">
                      <stop stopColor="#fff" />
                      <stop offset="1" stopColor="rgba(255,255,255,0.6)" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className={styles.logoLabel}><strong>HLB</strong> 보컬스튜디오</span>
            </Link>
            <p>7년 경력 보컬 트레이너의 커리큘럼과 AI가 결합된 차세대 보컬 트레이닝 플랫폼입니다. 당신의 목소리가 가진 진짜 가능성을 깨워드립니다.</p>
          </div>

          <div className={styles.footerCol}>
            <h4>서비스</h4>
            <a href="#features">기능 소개</a>
            <a href="#how">사용 방법</a>
            <a href="#pricing">요금제</a>
            <a href="#demo">AI 체험</a>
          </div>

          <div className={styles.footerCol}>
            <h4>회사</h4>
            <a href="#">트레이너 소개</a>
            <a href="#">블로그</a>
            <a href="#">채용</a>
            <a href="#">문의하기</a>
          </div>

          <div className={styles.footerCol}>
            <h4>법적 고지</h4>
            <a href="#">이용약관</a>
            <a href="#">개인정보처리방침</a>
            <a href="#">쿠키 정책</a>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>&copy; 2025 HLB 보컬스튜디오. All rights reserved.</p>
          <div className={styles.footerSocials}>
            <a className={styles.socIcon} href="#" title="YouTube" aria-label="YouTube"><IconYoutube size={16} /></a>
            <a className={styles.socIcon} href="#" title="Instagram" aria-label="Instagram"><IconInstagram size={16} /></a>
            <a className={styles.socIcon} href="#" title="TikTok" aria-label="TikTok"><IconTiktok size={16} /></a>
            <a className={styles.socIcon} href="#" title="Twitter" aria-label="Twitter"><IconTwitter size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}

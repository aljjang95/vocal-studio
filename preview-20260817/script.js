(() => {
  'use strict';

  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setHeader = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 20);
  };
  setHeader();
  window.addEventListener('scroll', setHeader, { passive: true });

  const closeMenu = () => {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '메뉴 열기');
    mobileMenu.hidden = true;
    document.body.classList.remove('menu-open');
  };

  menuButton?.addEventListener('click', () => {
    if (!mobileMenu) return;
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.setAttribute('aria-label', open ? '메뉴 열기' : '메뉴 닫기');
    mobileMenu.hidden = open;
    document.body.classList.toggle('menu-open', !open);
  });

  mobileMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  window.addEventListener('resize', () => { if (window.innerWidth > 820) closeMenu(); });

  const reveals = document.querySelectorAll('.reveal:not(.is-visible)');
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    reveals.forEach((el) => revealObserver.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  const axisContent = {
    larynx: {
      kicker: 'AXIS 01 · LARYNX',
      title: '음이 올라갈 때,\n후두가 먼저 버티고 있지 않은가.',
      description: '후두가 과하게 들리거나 눌리는 구간을 확인합니다. 힘을 무조건 빼기보다, 어떤 모음과 음역에서 패턴이 반복되는지 먼저 기록합니다.',
      checks: ['음역별 위치 변화', '모음별 긴장 패턴', '곡 안에서 재현 여부']
    },
    tongue: {
      kicker: 'AXIS 02 · TONGUE ROOT',
      title: '발음이 선명해질수록,\n혀뿌리가 통로를 막고 있지 않은가.',
      description: '발음과 고음에서 혀가 뒤로 당겨져 소리의 통로를 좁히는지 살핍니다. 자음과 모음의 움직임을 분리해 과한 개입을 줄입니다.',
      checks: ['자음별 당김 확인', '모음 전환 비교', '혀의 복귀 속도']
    },
    jaw: {
      kicker: 'AXIS 03 · JAW',
      title: '입을 크게 여는 동작이,\n턱의 힘으로 바뀌고 있지 않은가.',
      description: '입을 여는 범위와 턱이 버티는 힘을 구분합니다. 턱의 움직임이 호흡과 발음에 끼치는 영향을 곡의 구간별로 확인합니다.',
      checks: ['개구 범위 확인', '턱·목 동시 긴장', '발음 속도별 비교']
    },
    register: {
      kicker: 'AXIS 04 · REGISTER',
      title: '가슴소리와 머리소리 사이,\n압력과 공명이 끊기고 있지 않은가.',
      description: '성구가 전환되는 음역에서 소리가 밀리거나 빠지는 지점을 찾습니다. 압력과 공명 비율을 조정해 연결감을 만듭니다.',
      checks: ['전환 음역 기록', '압력 변화 확인', '공명 이동 연결']
    }
  };

  const axisButtons = document.querySelectorAll('[data-axis]');
  const axisKicker = document.querySelector('[data-axis-kicker]');
  const axisTitle = document.querySelector('[data-axis-title]');
  const axisDescription = document.querySelector('[data-axis-description]');
  const axisChecks = document.querySelector('[data-axis-checks]');

  const activateAxis = (key) => {
    const data = axisContent[key];
    if (!data || !axisKicker || !axisTitle || !axisDescription || !axisChecks) return;
    axisButtons.forEach((button) => {
      const active = button.dataset.axis === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    axisKicker.textContent = data.kicker;
    axisTitle.innerHTML = data.title.replace('\n', '<br>');
    axisDescription.textContent = data.description;
    axisChecks.replaceChildren(...data.checks.map((item) => {
      const span = document.createElement('span');
      span.textContent = item;
      return span;
    }));
  };
  axisButtons.forEach((button) => button.addEventListener('click', () => activateAxis(button.dataset.axis)));

  document.querySelectorAll('[data-accordion] button').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('.accordion-item');
      const panel = item?.querySelector('.accordion-panel');
      if (!panel) return;
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  });

  if (!reducedMotion) {
    const parallax = document.querySelector('[data-parallax]');
    window.addEventListener('scroll', () => {
      if (!parallax || window.innerWidth < 821) return;
      const rect = parallax.getBoundingClientRect();
      const progress = Math.max(-1, Math.min(1, (window.innerHeight / 2 - rect.top - rect.height / 2) / window.innerHeight));
      parallax.style.transform = `translate3d(0, ${progress * 9}px, 0)`;
    }, { passive: true });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();

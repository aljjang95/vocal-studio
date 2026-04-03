'use client';

import styles from './QuickChips.module.css';

const QUICK_QUESTIONS = [
  '고음을 편하게 내는 법',
  '호흡 훈련 방법',
  '음정이 자꾸 틀려요',
  '발음 교정하고 싶어요',
  '오디션 준비 도움',
  '복식호흡 연습법',
];

interface QuickChipsProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export default function QuickChips({ onSelect, disabled }: QuickChipsProps) {
  return (
    <div className={styles.chips}>
      {QUICK_QUESTIONS.map((q) => (
        <button
          key={q}
          className={styles.chip}
          onClick={() => onSelect(q)}
          disabled={disabled}
          type="button"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

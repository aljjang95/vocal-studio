'use client';

import { useRef, KeyboardEvent } from 'react';
import { IconSend } from '@/components/shared/Icons';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const text = inputRef.current?.value.trim();
    if (!text || disabled) return;
    inputRef.current!.value = '';
    onSend(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.chatInputBar}>
      <input
        ref={inputRef}
        className={styles.chatInput}
        type="text"
        placeholder="보컬에 대해 무엇이든 물어보세요..."
        onKeyDown={handleKeyDown}
        disabled={disabled}
        maxLength={2000}
        aria-label="메시지 입력"
      />
      <button
        className={styles.sendBtn}
        onClick={handleSend}
        disabled={disabled}
        type="button"
        aria-label="전송"
      >
        <IconSend size={16} />
      </button>
    </div>
  );
}

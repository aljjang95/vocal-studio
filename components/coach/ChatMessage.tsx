import { Message } from '@/types';
import { IconMic, IconUser } from '@/components/shared/Icons';
import styles from './ChatMessage.module.css';

interface ChatMessageProps {
  message: Message;
}

// RISK-1 수정: dangerouslySetInnerHTML 제거.
// 텍스트를 줄바꿈(\n)과 **bold** 패턴으로 파싱해 React 엘리먼트로 렌더링.
// HTML 문자열을 직접 삽입하지 않으므로 XSS 위험 없음.
function parseContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  text.split('\n').forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}-${text.slice(0, 8).replace(/\W/g, '')}`} />);

    // **bold** 처리
    const parts = line.split(/\*\*(.*?)\*\*/g);
    parts.forEach((part, partIdx) => {
      if (partIdx % 2 === 1) {
        nodes.push(<strong key={`b-${lineIdx}-${partIdx}-${part.slice(0,6).replace(/\W/g,"")}`}>{part}</strong>);
      } else if (part) {
        nodes.push(part);
      }
    });
  });

  return nodes;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`${styles.chatMsg} ${isUser ? styles.user : styles.ai}`}>
      <div className={`${styles.chatAvatar} ${isUser ? styles.userAv : styles.aiAv}`}>
        {isUser ? <IconUser size={14} /> : <IconMic size={14} />}
      </div>
      <div className={styles.chatBubble}>
        {parseContent(message.content)}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className={`${styles.chatMsg} ${styles.ai}`}>
      <div className={`${styles.chatAvatar} ${styles.aiAv}`}><IconMic size={14} /></div>
      <div className={styles.chatBubble} style={{ padding: '8px 14px' }}>
        <div className={styles.typingDots}>
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

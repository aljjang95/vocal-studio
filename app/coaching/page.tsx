import type { Metadata } from 'next';
import CoachingPageClient from './CoachingPageClient';

export const metadata: Metadata = {
  title: '맞춤 코칭 — HLB 보컬스튜디오',
  description: '7카테고리 28레슨으로 구성된 보컬 커리큘럼과 AI 코치의 실시간 피드백을 받으세요.',
};

export default function CoachingPage() {
  return <CoachingPageClient />;
}

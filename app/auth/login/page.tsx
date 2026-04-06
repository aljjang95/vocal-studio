'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
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

    router.push('/journey');
    router.refresh();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030712', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: '2rem' }}>
          HLB 보컬스튜디오 로그인
        </h1>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.25rem' }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #374151', backgroundColor: '#111827', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
              placeholder="vocal@example.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.25rem' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #374151', backgroundColor: '#111827', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
              placeholder="6자 이상"
            />
          </div>

          {error && (
            <p style={{ color: '#f87171', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
              backgroundColor: loading ? '#374151' : '#4f46e5', color: 'white',
              fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          계정이 없으신가요?{' '}
          <Link href="/auth/signup" style={{ color: '#818cf8', textDecoration: 'underline' }}>
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}

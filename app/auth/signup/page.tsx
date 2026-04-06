'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message === 'User already registered'
        ? '이미 가입된 이메일입니다.'
        : authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030712', padding: '1rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</p>
          <h2 style={{ color: 'white', fontSize: '1.25rem', marginBottom: '0.5rem' }}>이메일을 확인해주세요</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            <span style={{ color: '#818cf8' }}>{email}</span>로 인증 링크를 보냈습니다.
            <br />링크를 클릭하면 가입이 완료됩니다.
          </p>
          <Link href="/auth/login" style={{ display: 'inline-block', marginTop: '1.5rem', color: '#818cf8', textDecoration: 'underline' }}>
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030712', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: '2rem' }}>
          HLB 보컬스튜디오 회원가입
        </h1>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.25rem' }}>이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #374151', backgroundColor: '#111827', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
              placeholder="홍길동"
            />
          </div>

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
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          이미 계정이 있으신가요?{' '}
          <Link href="/auth/login" style={{ color: '#818cf8', textDecoration: 'underline' }}>
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}

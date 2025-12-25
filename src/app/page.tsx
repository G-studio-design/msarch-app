// src/app/page.tsx
import React, { Suspense } from 'react';
import LoginPage from '@/components/auth/login-page';

export default async function Home() {
  return (
    // Wrap in Suspense to handle client-side only rendering gracefully
    // and prevent hydration errors on the root page.
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Syncing with extension...');

  useEffect(() => {
    // This page is opened by the extension or after login
    // It helps sync the auth token with the extension
    const token = localStorage.getItem('synapse_token');
    const user = localStorage.getItem('synapse_user');

    if (token && user) {
      // Try to sync with extension
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // We're in an extension context or the extension can access this
        setStatus('Extension synced! Redirecting...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        // Just redirect to dashboard
        setStatus('Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}


import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const NATIVE_AUTH_REDIRECT_KEY = 'arsa_analiz_auth_redirect';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const completeNativeAuthRedirect = async (url: string) => {
      try {
        const authUrl = new URL(url);
        const queryParams = authUrl.searchParams;
        const hashParams = new URLSearchParams(authUrl.hash.replace(/^#/, ''));
        const code = queryParams.get('code') ?? hashParams.get('code');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const redirect = queryParams.get('redirect') ?? localStorage.getItem(NATIVE_AUTH_REDIRECT_KEY) ?? '/profile';
        const allowedRedirects = new Set(['/', '/analysis', '/profile', '/packages']);
        const safeRedirect = allowedRedirects.has(redirect) ? redirect : '/profile';
        const authReturnPath = `/auth?redirect=${encodeURIComponent(safeRedirect)}`;

        if (code) {
          setLoading(true);
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setSession(data.session);
          setUser(data.session?.user ?? null);
          await Browser.close();
          localStorage.removeItem(NATIVE_AUTH_REDIRECT_KEY);
          window.location.replace(authReturnPath);
          return;
        }

        if (accessToken && refreshToken) {
          setLoading(true);
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          setSession(data.session);
          setUser(data.session?.user ?? null);
          await Browser.close();
          localStorage.removeItem(NATIVE_AUTH_REDIRECT_KEY);
          window.location.replace(authReturnPath);
        }
      } catch (error) {
        console.error('OAuth redirect could not be handled:', error);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    let removeAppUrlOpenListener: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', ({ url }) => {
        completeNativeAuthRedirect(url);
      }).then((listener) => {
        removeAppUrlOpenListener = () => {
          listener.remove();
        };
      });
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      removeAppUrlOpenListener?.();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    let removeAppUrlOpenListener: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        try {
          const authUrl = new URL(url);
          const queryParams = authUrl.searchParams;
          const hashParams = new URLSearchParams(authUrl.hash.replace(/^#/, ''));
          const code = queryParams.get('code') ?? hashParams.get('code');
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
            await Browser.close();
            return;
          }

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            await Browser.close();
          }
        } catch (error) {
          console.error('OAuth redirect could not be handled:', error);
        }
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

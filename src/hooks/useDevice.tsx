import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeviceProfile {
  id: string;
  device_id: string;
  credits: number;
  created_at: string;
}

interface DeviceContextType {
  deviceId: string | null;
  profile: DeviceProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

const generateDeviceId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `device_${timestamp}_${randomPart}`;
};

const getDeviceId = (): string => {
  const storageKey = 'arsa_analiz_device_id';
  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
};

async function loadLinkedProfile(deviceId: string): Promise<DeviceProfile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;

  if (!userId) {
    return null;
  }

  const { data: linkData, error: linkError } = await supabase.rpc('link_device_to_user', { p_device_id: deviceId });

  if (linkError) {
    console.error('Error linking device to user:', linkError);
    return null;
  }

  const linkResult = linkData as {
    success?: boolean;
    error?: string;
    profile_id?: string;
    device_id?: string;
    credits?: number;
  } | null;

  if (!linkResult?.success || !linkResult.profile_id) {
    console.error('Device link failed:', linkResult?.error || 'unknown_error');
    return null;
  }

  return {
    id: linkResult.profile_id,
    device_id: linkResult.device_id || deviceId,
    credits: linkResult.credits ?? 0,
    created_at: new Date().toISOString(),
  };
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!deviceId) return;
    const profileData = await loadLinkedProfile(deviceId);
    setProfile(profileData);
  };

  useEffect(() => {
    const devId = getDeviceId();
    setDeviceId(devId);

    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);
      const profileData = await loadLinkedProfile(devId);
      if (mounted) {
        setProfile(profileData);
        setLoading(false);
      }
    };

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      loadProfile();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <DeviceContext.Provider value={{ deviceId, profile, loading, refreshProfile }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}

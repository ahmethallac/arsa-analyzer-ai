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

// Generate a unique device ID
const generateDeviceId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `device_${timestamp}_${randomPart}`;
};

// Get or create device ID from localStorage
const getDeviceId = (): string => {
  const storageKey = 'arsa_analiz_device_id';
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(storageKey, deviceId);
  }
  
  return deviceId;
};

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateProfile = async (devId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_or_create_device_profile', { p_device_id: devId });

      if (error) {
        console.error('Error fetching/creating profile:', error);
        return null;
      }

      if (data && data.length > 0) {
        return {
          id: data[0].id,
          device_id: data[0].device_id,
          credits: data[0].credits,
          created_at: data[0].created_at
        } as DeviceProfile;
      }
      return null;
    } catch (err) {
      console.error('Error in fetchOrCreateProfile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (deviceId) {
      const profileData = await fetchOrCreateProfile(deviceId);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    const initDevice = async () => {
      const devId = getDeviceId();
      setDeviceId(devId);
      
      const profileData = await fetchOrCreateProfile(devId);
      setProfile(profileData);
      setLoading(false);
    };

    initDevice();
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

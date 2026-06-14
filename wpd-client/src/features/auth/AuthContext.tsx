import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import axios from 'axios';
import type { WpdUser } from '../../types/index';
import { configureApiAuth } from '../../api/apiClient';

interface WpdAuthContextType {
  wpdUser: WpdUser | null;
  isLoading: boolean;
}

const WpdAuthContext = createContext<WpdAuthContextType | undefined>(undefined);

export const WpdAuthProvider = ({ children }: { children: ReactNode }) => {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { getToken } = useClerkAuth();
  const [wpdUser, setWpdUser] = useState<WpdUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authConfigured = useRef(false);

  // Wire Clerk token into the shared apiClient once
  useEffect(() => {
    if (!authConfigured.current) {
      configureApiAuth(getToken);
      authConfigured.current = true;
    }
  }, [getToken]);

  useEffect(() => {
    if (!clerkLoaded) return;

    if (!clerkUser) {
      setWpdUser(null);
      setIsLoading(false);
      return;
    }

    const provision = async () => {
      try {
        const token = await getToken();
        const baseURL = import.meta.env.VITE_API_URL;
        const response = await axios.post<WpdUser>(
          `${baseURL}/api/auth/provision`,
          {
            email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
            displayName: clerkUser.fullName ?? clerkUser.primaryEmailAddress?.emailAddress ?? '',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setWpdUser(response.data);
      } catch (err) {
        console.error('Failed to provision WPD user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    provision();
  }, [clerkUser, clerkLoaded, getToken]);

  return (
    <WpdAuthContext.Provider value={{ wpdUser, isLoading }}>
      {children}
    </WpdAuthContext.Provider>
  );
};

export const useWpdAuth = () => {
  const context = useContext(WpdAuthContext);
  if (context === undefined) {
    throw new Error('useWpdAuth must be used within a WpdAuthProvider');
  }
  return context;
};

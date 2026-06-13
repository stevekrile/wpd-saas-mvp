import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, LoginRequest, RegisterRequest } from '../../types/index';
import { authApi } from '../../api/authApi.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (data: LoginRequest) => {
    const response = await authApi.login(data);
    setToken(response.token);
    const userData: User = {
      userId: response.userId,
      email: response.email,
      displayName: response.displayName,
      subscriptionTierId: response.subscriptionTierId,
      subscriptionTierName: response.subscriptionTierName,
    };
    setUser(userData);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const register = async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    setToken(response.token);
    const userData: User = {
      userId: response.userId,
      email: response.email,
      displayName: response.displayName,
      subscriptionTierId: response.subscriptionTierId,
      subscriptionTierName: response.subscriptionTierName,
    };
    setUser(userData);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
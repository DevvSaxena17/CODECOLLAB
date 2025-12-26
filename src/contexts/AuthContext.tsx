import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import {
  getCurrentUser,
  setCurrentUser,
  createUserWithPassword,
  verifyPassword,
} from '../lib/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const newUser = createUserWithPassword(email, password, name);
      setCurrentUser(newUser);
      setUser(newUser);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err.message || 'Failed to create account' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const user = verifyPassword(email, password);
      if (!user) {
        return { error: { message: 'Invalid email or password' } };
      }
      setCurrentUser(user);
      setUser(user);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err.message || 'Failed to sign in' } };
    }
  };

  const signOut = async () => {
    setCurrentUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
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


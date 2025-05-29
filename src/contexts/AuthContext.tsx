
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserInternal] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Try to load user from localStorage on initial load
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser) as UserProfile;
        // Convert Firestore Timestamp-like objects back to Date objects if necessary
        if (parsedUser.createdAt && typeof parsedUser.createdAt === 'object' && 'seconds' in parsedUser.createdAt) {
           parsedUser.createdAt = new Date((parsedUser.createdAt as any).seconds * 1000);
        }
        setCurrentUserInternal(parsedUser);
      }
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
      localStorage.removeItem('currentUser'); // Clear corrupted data
    }
    setIsLoading(false);
  }, []);

  const setCurrentUser = (user: UserProfile | null) => {
    setCurrentUserInternal(user);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

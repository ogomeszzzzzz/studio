
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
  const [isLoading, setIsLoading] = useState(true); // Start true
  const router = useRouter();

  useEffect(() => {
    console.log('[AuthContext] Initializing: Attempting to load user from localStorage.');
    let userLoaded = false;
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser) as UserProfile;
        if (parsedUser.createdAt && typeof parsedUser.createdAt === 'object' && 'seconds' in parsedUser.createdAt) {
           parsedUser.createdAt = new Date((parsedUser.createdAt as any).seconds * 1000);
        }
        setCurrentUserInternal(parsedUser);
        userLoaded = true;
        console.log('[AuthContext] User loaded from localStorage:', parsedUser.email);
      } else {
        console.log('[AuthContext] No user found in localStorage.');
      }
    } catch (error) {
      console.error("[AuthContext] Error loading user from localStorage:", error);
      localStorage.removeItem('currentUser'); 
    }
    setIsLoading(false); // Crucial: set loading to false regardless of finding a user
    console.log('[AuthContext] Initialization complete. isLoading set to false. User was loaded:', userLoaded);
  }, []);

  const setCurrentUser = (user: UserProfile | null) => {
    console.log('[AuthContext] setCurrentUser called. New user:', user ? user.email : null);
    setCurrentUserInternal(user);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
    // If setting user to null (logout), ensure isLoading is false, as we are not in an initial loading state.
    // If setting user (login), isLoading should ideally already be false from init.
    if (isLoading && !user) {
        console.warn("[AuthContext] setCurrentUser (logout) called while isLoading was true. Setting isLoading to false.");
        setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('[AuthContext] logout called.');
    setCurrentUser(null); // This will also remove from localStorage
    // No need to push to /login here if AppLayout handles it, but can be a safeguard.
    // router.push('/login'); // Re-evaluate if needed, page.tsx and AppLayout should handle this.
  };

  console.log(`[AuthContext] Provider rendering. isLoading: ${isLoading}, currentUser: ${currentUser ? currentUser.email : 'null'}`);
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

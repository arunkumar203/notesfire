'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { getDatabase, ref, set, get } from 'firebase/database';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Set up auth state persistence
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Client-side only
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Failed to parse user from localStorage', error);
          localStorage.removeItem('user');
        }
      }
    }
  }, []);

  // Update localStorage when user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Successfully logged in!');
    } catch (error: any) {
      console.error('Error signing in:', error);
      toast.error(error.message || 'Failed to log in');
      throw error;
    }
  };

  const signup = async (email: string, password: string): Promise<void> => {
    let user: User | null = null;
    const db = getDatabase();
    
    try {
      // 1. First, create the user in Firebase Auth (but don't sign in yet)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      user = userCredential.user;
      
      if (!user) {
        throw new Error('Failed to create user');
      }
      
      // 2. Prepare user data
      const displayName = email.split('@')[0] || 'User';
      const userData = {
        email: user.email,
        displayName: displayName,
        photoURL: '',
        createdAt: Date.now(),
        lastLogin: Date.now()
      };
      
      // 3. Start a transaction to ensure atomicity
      const userRef = ref(db, `users/${user.uid}`);
      
      // 4. First, try to create the database record
      await set(userRef, userData);
      
      try {
        // 5. If database write succeeds, update the auth profile
        await updateProfile(user, { displayName });
        
        // 6. Sign in the user after successful profile creation
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Account created successfully!');
        
      } catch (authError) {
        console.error('Failed to update auth profile:', authError);
        // If auth update fails, try to clean up the database record
        try {
          await set(userRef, null); // Remove the database record
        } catch (cleanupError) {
          console.error('Failed to clean up database after auth error:', cleanupError);
        }
        throw new Error('Failed to complete user setup. Please try again.');
      }
      
    } catch (error) {
      console.error('Signup error:', error);
      
      // If we have a user object but something failed, try to clean up
      if (user) {
        try {
          await user.delete();
          console.log('Rolled back user creation due to error');
        } catch (deleteError) {
          console.error('Failed to rollback user creation:', deleteError);
        }
      }
      
      // Re-throw with a user-friendly message
      if (error instanceof Error) {
        if (error.message.includes('email-already-in-use')) {
          throw new Error('This email is already in use. Please use a different email or sign in.');
        } else if (error.message.includes('weak-password')) {
          throw new Error('Password should be at least 6 characters long.');
        } else if (error.message.includes('invalid-email')) {
          throw new Error('Please enter a valid email address.');
        }
      }
      
      throw new Error('Failed to create account. Please try again later.');
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (!user) {
        throw new Error('Failed to sign in with Google');
      }
      
      toast.success('Successfully logged in with Google!');
      
      // 2. Prepare user data for database
      const db = getDatabase();
      const userRef = ref(db, `users/${user.uid}`);
      
      // 3. Check if this is a new user
      let isNewUser = false;
      let userData: Record<string, any> = {
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        lastLogin: Date.now()
      };
      
      try {
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
          // New user - set creation timestamp
          isNewUser = true;
          userData.createdAt = Date.now();
        } else {
          // Existing user - preserve existing data and just update lastLogin
          const existingData = snapshot.val();
          userData = {
            ...existingData,
            lastLogin: Date.now(),
            // Update these fields if they've changed
            email: user.email,
            displayName: user.displayName || existingData.displayName,
            photoURL: user.photoURL || existingData.photoURL
          };
        }
        
        // 4. Update user profile in database
        await set(userRef, userData);
        
        // 5. If this is a new user and we have additional profile data
        if (isNewUser && user.displayName) {
          await updateProfile(user, {
            displayName: user.displayName,
            photoURL: user.photoURL || ''
          });
        }
        
      } catch (dbError) {
        console.error('Failed to update user profile in database:', dbError);
        
        // If we failed to update the database, sign the user out to maintain consistency
        try {
          await signOut(auth);
          console.log('Signed out user due to database update failure');
        } catch (signOutError) {
          console.error('Failed to sign out user after database error:', signOutError);
        }
        
        throw new Error('Failed to complete sign in. Please try again.');
      }
      
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      
      // If we have a user object but something failed, try to clean up
      if (user) {
        try {
          // Only delete the user if this was a new signup that failed
          const userRef = ref(getDatabase(), `users/${user.uid}`);
          const snapshot = await get(userRef);
          
          if (!snapshot.exists()) {
            await user.delete();
            console.log('Rolled back user creation due to error');
          }
        } catch (cleanupError) {
          console.error('Failed to clean up after Google sign-in error:', cleanupError);
        }
      }
      
      // Handle specific error cases
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email but different sign-in credentials.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign in was cancelled. Please try again.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection and try again.');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        throw new Error('Sign in was cancelled. Please try again.');
      }
      
      throw new Error('Failed to sign in with Google. Please try again.');
    }
  };

  const logout = async () => {
    try {
      // Set a flag to prevent the login required toast
      sessionStorage.setItem('isLoggingOut', 'true');
      
      await signOut(auth);
      toast.success('Logged out successfully');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error(error.message || 'Failed to log out');
      throw error;
    } finally {
      // Clean up the flag after a short delay
      setTimeout(() => {
        sessionStorage.removeItem('isLoggingOut');
      }, 1000);
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
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

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, fbGet } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (googleUser) => {
      if (googleUser) {
        try {
          const profile = await fbGet(`players/${googleUser.uid}`);
          if (profile && !profile.redirectTo) {
            setCurrentUser({ ...profile, uid: googleUser.uid, email: googleUser.email });
            setPendingGoogleUser(null);
          } else {
            // Google auth ok but no profile yet — need username setup
            setCurrentUser(null);
            setPendingGoogleUser({
              uid: googleUser.uid,
              email: googleUser.email,
              displayName: googleUser.displayName,
              photoURL: googleUser.photoURL,
            });
          }
        } catch (e) {
          setCurrentUser(null);
          setPendingGoogleUser(null);
        }
      } else {
        setCurrentUser(null);
        setPendingGoogleUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const refreshUser = async () => {
    if (!currentUser?.uid) return;
    const profile = await fbGet(`players/${currentUser.uid}`);
    if (profile && !profile.redirectTo) {
      setCurrentUser({ ...profile, uid: currentUser.uid, email: currentUser.email });
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, pendingGoogleUser, setPendingGoogleUser, authLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "super_admin";
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  jwtToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ success: boolean; error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [jwtToken, setJwtToken] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/admin-session");

        if (response.ok) {
          const data = await response.json();
          if (isMounted && data.authenticated && data.user) {
            setUser(data.user);
            if (data.token) {
              setJwtToken(data.token);
            }
          }
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || "Login failed" } };
      }

      setUser(data.user);
      setJwtToken(data.token);
      return { error: null };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error: { message: "Network error. Please try again." } };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/admin-logout", { method: "POST" });
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setUser(null);
      setJwtToken(null);
    }
    return { success: true };
  }, []);

  // Computed values
  const isAuthenticated = !!user;
  const isAdmin = user
    ? ["admin", "super_admin"].includes(user.role)
    : false;
  const isSuperAdmin = user ? user.role === "super_admin" : false;

  const value = {
    user,
    loading,
    jwtToken,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Keep backward compatibility - SupabaseAuthProvider is now an alias
export const SupabaseAuthProvider = AdminAuthProvider;

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AdminAuthProvider");
  }
  return context;
}

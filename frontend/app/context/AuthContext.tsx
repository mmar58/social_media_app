"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
  notifications: any[];
  unread: number;
  markAllRead: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    // Check for token in localStorage on mount
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      // try cookie-based auth if available (httpOnly cookie)
      fetchUser();
    }
  }, []);

  const fetchUser = async (authToken?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const res = await fetch("http://localhost:5000/api/auth/me", {
        headers,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        // persist refreshed token if backend provided one
        if (data.token) {
          localStorage.setItem("token", data.token);
          setToken(data.token);
        }
        setUser(data.user);
      } else {
        // Invalid token
        localStorage.removeItem("token");
        setToken(null);
      }
    } catch (e) {
      console.error("Failed to fetch user", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async (authToken?: string) => {
    try {
      const t = authToken || token;
      if (!t) return;
      const res = await fetch("http://localhost:5000/api/notifications", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnread(data.unread || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const login = (newToken: string, loggedUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(loggedUser);
    router.push("/feed"); // Or / depending on where feed is
  };

  const logout = () => {
    // try to clear server-side cookie as well
    try {
      fetch("http://localhost:5000/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    } catch (e) {}
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  // mark all read
  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch("http://localhost:5000/api/notifications/mark-all-read", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((n) => n.map((x) => ({ ...x, is_read: true })));
      setUnread(0);
    } catch (e) {
      console.error(e);
    }
  };

  const markRead = async (id: number) => {
    if (!token) return;
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((n) => n.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // setup socket and fetch notifications when user available
    if (!user || !token) return;
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
    const s = io(socketUrl);
    setSocket(s);

    s.on("connect", () => {
      try {
        s.emit("register", user.id);
      } catch (e) {
        console.error(e);
      }
    });

    s.on("notification", (n: any) => {
      setNotifications((prev) => [n, ...prev]);
      setUnread((u) => u + 1);
    });

    // initial fetch
    fetchNotifications(token);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user, token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, notifications, unread, markAllRead, markRead }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

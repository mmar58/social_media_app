"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { apiUrl, socketBaseUrl } from "../lib/api";
import { invalidateRequestCache, requestJson } from "../lib/request";

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture?: string;
}

interface AuthContextType {
  user: User | null;
  socket: Socket | null;
  login: (user: User) => void;
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
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const data = await requestJson<any>(apiUrl("/api/auth/me"), {
        credentials: "include",
      });

      setUser(data.user);
    } catch (e) {
      invalidateRequestCache();
      setUser(null);
      setNotifications([]);
      setUnread(0);
      console.error("Failed to fetch user", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!user) return;

      const data = await requestJson<any>(apiUrl("/api/notifications"), {
        credentials: "include",
      }, {
        dedupeKey: `notifications:${user.id}`,
        cacheTtlMs: 3000,
      });
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const login = (loggedUser: User) => {
    invalidateRequestCache();
    setUser(loggedUser);
    router.push("/feed"); // Or / depending on where feed is
  };

  const logout = () => {
    // try to clear server-side cookie as well
    try {
      fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
    } catch (e) {}
    invalidateRequestCache();
    setUser(null);
    setNotifications([]);
    setUnread(0);
    router.push("/login");
  };

  // mark all read
  const markAllRead = async () => {
    if (!user) return;
    try {
      await requestJson(apiUrl("/api/notifications/mark-all-read"), {
        method: "POST",
        credentials: "include",
      });
      setNotifications((n) => n.map((x) => ({ ...x, is_read: true })));
      setUnread(0);
    } catch (e) {
      console.error(e);
    }
  };

  const markRead = async (id: number) => {
    if (!user) return;
    try {
      await requestJson(apiUrl(`/api/notifications/${id}/read`), {
        method: "POST",
        credentials: "include",
      });
      setNotifications((n) => n.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // setup socket and fetch notifications when user available
    if (!user) return;
    const s = io(socketBaseUrl, { withCredentials: true });
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
    fetchNotifications();

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, socket, login, logout, loading, notifications, unread, markAllRead, markRead }}>
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

"use client";

import { AuthProvider } from "./context/AuthContext";
import { PostProvider } from "./context/PostContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PostProvider>
        {children}
      </PostProvider>
    </AuthProvider>
  );
}

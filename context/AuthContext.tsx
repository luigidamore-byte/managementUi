"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Persona {
  id: number;
  name: string;
  role: number;
  group: string;
  username?: string;
  password?: string;
  brand?: string;
  position?: string;
}

interface AuthContextType {
  user: Persona | null;
  login: (username: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on mount
    const saved = localStorage.getItem("ui-management-user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing saved user", e);
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("Persone")
        .select("*")
        .eq("username", username)
        .eq("password", pass)
        .single();

      if (error || !data) {
        setLoading(false);
        return { success: false, message: "Credenziali non valide" };
      }

      setUser(data);
      localStorage.setItem("ui-management-user", JSON.stringify(data));
      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, message: "Errore di connessione al database" };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("ui-management-user");
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

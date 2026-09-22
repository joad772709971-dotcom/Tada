import React, { createContext, useContext, useState, useEffect } from "react";
import { TenantThemeMode } from "../types";

export interface DesignTokens {
  themeName: string;
  themeNameAr: string;
  bgPage: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  primaryColor: string; // Tailored color code (hex or Tailwind class)
  accentColor: string;  // Secondary visual accent
  borderClass: string;
  inputBg: string;
  headerBg: string;
  accentBadge: string;
  sidebarBg: string;
  shadowColor: string;
}

export const THEME_PRESETS: Record<TenantThemeMode, DesignTokens> = {
  "luxury-gold": {
    themeName: "Luxury Gold Reserve",
    themeNameAr: "المخزون الذهبي الفاخر",
    bgPage: "bg-[#0A0A0A]",
    bgCard: "bg-[#141414]",
    textPrimary: "text-amber-100",
    textSecondary: "text-amber-200/60",
    primaryColor: "#D4AF37", // Bright Gold
    accentColor: "#F59E0B",  // Gold Amber
    borderClass: "border-amber-500/30",
    inputBg: "bg-[#1E1E1E] text-amber-100 border-amber-500/20 focus:border-amber-400",
    headerBg: "bg-[#111111]/80 border-b border-amber-500/20",
    accentBadge: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
    sidebarBg: "bg-[#111111]",
    shadowColor: "shadow-amber-900/10"
  },
  "chrome-industrial": {
    themeName: "Chrome Industrial",
    themeNameAr: "الكروم الصناعي الممتاز",
    bgPage: "bg-[#0F172A]",
    bgCard: "bg-[#1E293B]",
    textPrimary: "text-slate-100",
    textSecondary: "text-slate-400",
    primaryColor: "#3B82F6", // Electric steel blue
    accentColor: "#64748B",  // Metallic slate
    borderClass: "border-slate-800",
    inputBg: "bg-[#0F172A] text-slate-100 border-slate-700 focus:border-blue-500",
    headerBg: "bg-[#1E293B]/95 border-b border-slate-800",
    accentBadge: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    sidebarBg: "bg-[#0F172A]",
    shadowColor: "shadow-slate-950/20"
  },
  "eco-poultry-farm": {
    themeName: "Clean Minimalism (Eco-Farm)",
    themeNameAr: "التبسيط النظيف والريادة البيئية",
    bgPage: "bg-[#F4F7F1]",
    bgCard: "bg-white",
    textPrimary: "text-[#2D3A26]",
    textSecondary: "text-[#4A6741]",
    primaryColor: "#A4C639", // Eco Lime Green
    accentColor: "#1B3016",  // Deep Forest Green
    borderClass: "border-[#E1E8DC]",
    inputBg: "bg-[#F0F4ED] text-[#2D3A26] border-[#D1D9CD] focus:border-[#4A6741]",
    headerBg: "bg-white border-b border-[#E1E8DC]",
    accentBadge: "bg-[#F0F4ED] text-[#4A6741] border border-[#D1D9CD]",
    sidebarBg: "bg-[#1B3016]",
    shadowColor: "shadow-emerald-950/5"
  }
};

interface ThemeContextType {
  theme: TenantThemeMode;
  setTheme: (theme: TenantThemeMode) => void;
  tokens: DesignTokens;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<TenantThemeMode>("eco-poultry-farm");
  const [tokens, setTokens] = useState<DesignTokens>(THEME_PRESETS["eco-poultry-farm"]);

  // Dynamic theme change logic
  const setTheme = (newTheme: TenantThemeMode) => {
    setThemeState(newTheme);
    setTokens(THEME_PRESETS[newTheme]);
  };

  // Sync to body element so any overlays can access root parameters
  useEffect(() => {
    const root = window.document.documentElement;
    // Remove old classes
    root.classList.remove("theme-luxury-gold", "theme-chrome-industrial", "theme-eco-poultry-farm");
    // Add current theme class
    root.classList.add(`theme-${theme}`);
    
    // Set some inline style helpers for dynamic colors
    root.style.setProperty("--theme-primary", THEME_PRESETS[theme].primaryColor);
    root.style.setProperty("--theme-accent", THEME_PRESETS[theme].accentColor);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAdaptiveTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAdaptiveTheme must be used within a ThemeProvider");
  }
  return context;
}

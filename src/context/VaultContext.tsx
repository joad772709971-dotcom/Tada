import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

interface VaultContextType {
  isVaultOpen: boolean;
  vaultPassword?: string;
  vaultDate: string;
  setVaultDate: (date: string) => void;
  openVault: (password: string) => Promise<boolean>;
  closeVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children, profile }: { children: React.ReactNode, profile: UserProfile | null }) {
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [vaultPassword, setVaultPassword] = useState<string>();
  const [vaultDate, setVaultDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!profile?.ownerId) return;

    // Eagerly load from offline cached values first to grant instantaneous 0ms response
    const cachedOpen = localStorage.getItem(`jam_vault_is_open_${profile.ownerId}`) === 'true';
    const cachedPass = localStorage.getItem(`jam_vault_pass_${profile.ownerId}`) || '123456';
    setIsVaultOpen(cachedOpen);
    setVaultPassword(cachedPass);

    const unsubscribe = onSnapshot(doc(db, 'settings', profile.ownerId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const openVal = data.isVaultOpen || false;
        const passVal = data.vaultPassword || '123456';
        setIsVaultOpen(openVal);
        setVaultPassword(passVal);
        localStorage.setItem(`jam_vault_is_open_${profile.ownerId}`, openVal ? 'true' : 'false');
        localStorage.setItem(`jam_vault_pass_${profile.ownerId}`, passVal);
      }
    }, (error) => {
      console.warn("JAM SYSTEM PRO - Vault settings error fallback handled:", error.message);
      // Keep using eager cached values if snapshot fails
    });

    return () => unsubscribe();
  }, [profile]);

  // Reset vault date to today when vault is closed
  useEffect(() => {
    if (!isVaultOpen) {
      setVaultDate(new Date().toISOString().split('T')[0]);
    }
  }, [isVaultOpen]);

  const openVault = async (password: string) => {
    if (password === vaultPassword) {
      return true;
    }
    return false;
  };

  const closeVault = async () => {
    // Update Firestore to close vault
  };

  return (
    <VaultContext.Provider value={{ isVaultOpen, vaultPassword, vaultDate, setVaultDate, openVault, closeVault }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}

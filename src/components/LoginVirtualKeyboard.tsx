import React from 'react';

export interface LoginVirtualKeyboardProps {
  activeField?: 'username' | 'password';
  setActiveField?: (field: 'username' | 'password') => void;
  username?: string;
  setUsername?: (val: string | ((prev: string) => string)) => void;
  password?: string;
  setPassword?: (val: string | ((prev: string) => string)) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

export default function LoginVirtualKeyboard(_props: LoginVirtualKeyboardProps) {
  // Completely removed per user request: native hardware/device inputs are used exclusively
  return null;
}

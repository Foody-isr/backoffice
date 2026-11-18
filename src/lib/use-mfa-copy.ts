'use client';
import { useEffect, useState } from 'react';
import { mfaStrings } from './mfa-strings';

/** Selects browser copy after hydration without changing the server markup. */
export function useMFACopy() {
  const [locale, setLocale] = useState<'en' | 'fr' | 'he'>('en');
  useEffect(() => {
    const language = navigator.language.split('-')[0];
    setLocale(language === 'fr' || language === 'he' ? language : 'en');
  }, []);
  return { locale, t: (key: string) => mfaStrings[locale][key as keyof typeof mfaStrings.en] ?? key };
}

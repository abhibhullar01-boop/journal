import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type KeyName = 'openai' | 'anthropic';
const STORE_KEY: Record<KeyName, string> = { openai: 'voice-journal.openai-key', anthropic: 'voice-journal.anthropic-key' };

interface KeysValue {
  loaded: boolean;
  openai: string | null;
  anthropic: string | null;
  setKey(name: KeyName, value: string | null): Promise<void>;
}

const KeysContext = createContext<KeysValue | null>(null);

/** API keys the user pastes once. Kept in the iPhone keychain, never in the journal data. */
export function KeysProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [keys, setKeys] = useState<Record<KeyName, string | null>>({ openai: null, anthropic: null });

  useEffect(() => {
    (async () => {
      try {
        const [openai, anthropic] = await Promise.all([
          SecureStore.getItemAsync(STORE_KEY.openai),
          SecureStore.getItemAsync(STORE_KEY.anthropic),
        ]);
        setKeys({ openai, anthropic });
      } catch (error) {
        console.warn('Could not read saved keys', error);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const value = useMemo<KeysValue>(
    () => ({
      loaded,
      ...keys,
      async setKey(name, raw) {
        const value = raw?.trim() || null;
        if (value) await SecureStore.setItemAsync(STORE_KEY[name], value);
        else await SecureStore.deleteItemAsync(STORE_KEY[name]);
        setKeys((k) => ({ ...k, [name]: value }));
      },
    }),
    [loaded, keys],
  );

  return <KeysContext.Provider value={value}>{children}</KeysContext.Provider>;
}

export function useKeys(): KeysValue {
  const value = useContext(KeysContext);
  if (!value) throw new Error('useKeys must be used inside KeysProvider');
  return value;
}

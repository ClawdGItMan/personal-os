import * as SecureStore from "expo-secure-store";

/**
 * A Supabase auth-storage adapter backed by the OS keychain/keystore
 * (expo-secure-store) instead of unencrypted AsyncStorage — so session tokens
 * are encrypted at rest on device.
 *
 * SecureStore caps each value at ~2048 bytes and a Supabase session (access +
 * refresh JWTs) can exceed that, so values are transparently chunked across
 * keys. A `<key>__n` marker records the chunk count; short values are stored
 * whole under `<key>`. Native only — web uses localStorage (see supabase.ts).
 */
const CHUNK = 1800;

const countKey = (key: string) => `${key}__n`;
const partKey = (key: string, i: number) => `${key}__${i}`;

async function getItem(key: string): Promise<string | null> {
  const marker = await SecureStore.getItemAsync(countKey(key));
  if (marker == null) return SecureStore.getItemAsync(key);

  const n = Number.parseInt(marker, 10);
  let out = "";
  for (let i = 0; i < n; i++) {
    const part = await SecureStore.getItemAsync(partKey(key, i));
    if (part == null) return null; // partial/corrupt write — treat as absent
    out += part;
  }
  return out;
}

async function removeItem(key: string): Promise<void> {
  const marker = await SecureStore.getItemAsync(countKey(key));
  if (marker != null) {
    const n = Number.parseInt(marker, 10);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(partKey(key, i));
    await SecureStore.deleteItemAsync(countKey(key));
  }
  await SecureStore.deleteItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  await removeItem(key); // clear any prior whole value + stale chunks first
  if (value.length <= CHUNK) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const n = Math.ceil(value.length / CHUNK);
  await SecureStore.setItemAsync(countKey(key), String(n));
  for (let i = 0; i < n; i++) {
    await SecureStore.setItemAsync(partKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
}

export const secureStorage = { getItem, setItem, removeItem };

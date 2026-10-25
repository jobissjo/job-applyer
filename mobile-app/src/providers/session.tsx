import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { authApi } from "@/services/api";
import {
  ApiError,
  setAuthToken,
  setSessionExpiredHandler,
} from "@/services/http";
import type { User } from "@/types";

const KEY = "applypilot.session";
const storage = {
  get: async () =>
    Platform.OS === "web"
      ? sessionStorage.getItem(KEY)
      : SecureStore.getItemAsync(KEY),
  set: async (token: string) =>
    Platform.OS === "web"
      ? sessionStorage.setItem(KEY, token)
      : SecureStore.setItemAsync(KEY, token),
  clear: async () =>
    Platform.OS === "web"
      ? sessionStorage.removeItem(KEY)
      : SecureStore.deleteItemAsync(KEY),
};
type Session = {
  user: User | null;
  loading: boolean;
  error: string;
  restore: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
    register?: boolean,
  ) => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await storage.clear();
  }, []);
  const restore = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const saved = await storage.get();
      if (saved) {
        setAuthToken(saved);
        setUser(await authApi.getMe());
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await signOut();
      else
        setError(
          err instanceof Error
            ? err.message
            : "Could not restore your session.",
        );
    } finally {
      setLoading(false);
    }
  }, [signOut]);
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void signOut().catch(() =>
        setError("Could not clear the saved session. Try signing out again."),
      );
    });
    void Promise.resolve().then(restore);
    return () => setSessionExpiredHandler();
  }, [restore, signOut]);
  const signIn = async (email: string, password: string, register = false) => {
    if (register) await authApi.register(email.trim(), password);
    const result = await authApi.login(email.trim(), password);
    setAuthToken(result.access_token);
    try {
      const me = await authApi.getMe();
      await storage.set(result.access_token);
      setUser(me);
    } catch (err) {
      setAuthToken(null);
      throw err;
    }
  };
  return (
    <Context.Provider
      value={{ user, loading, error, restore, signIn, signOut }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing SessionProvider");
  return value;
}

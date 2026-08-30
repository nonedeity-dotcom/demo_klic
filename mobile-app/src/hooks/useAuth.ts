import { useCallback, useEffect, useState } from "react";
import { getToken, setToken, clearToken } from "../api/authStorage";
import { api } from "../api/client";
import { registerForPushNotifications } from "../notifications/registerPush";

export function useAuth() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = still checking

  useEffect(() => {
    getToken().then((t) => setLoggedIn(!!t));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await api.login(email, password);
    await setToken(token);
    setLoggedIn(true);
    await registerForPushNotifications(); // safe to call post-login every time
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const { token } = await api.register(email, password);
    await setToken(token);
    setLoggedIn(true);
    await registerForPushNotifications();
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setLoggedIn(false);
  }, []);

  return { loggedIn, login, register, logout };
}

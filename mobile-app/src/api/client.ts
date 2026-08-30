import Constants from "expo-constants";
import { getToken } from "./authStorage";

const API_URL = Constants.expoConfig?.extra?.apiUrl as string;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Small, explicit surface — one function per backend route rather than a
// generic ORM-style client. Keeps call sites readable and typed.
export const api = {
  register: (email: string, password: string) =>
    request<{ token: string }>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  getHabits: () => request("/habits"),
  addHabit: (label: string, hint?: string) =>
    request("/habits", { method: "POST", body: JSON.stringify({ label, hint }) }),
  updateHabit: (id: string, data: { label?: string; hint?: string }) =>
    request(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  removeHabit: (id: string) => request(`/habits/${id}`, { method: "DELETE" }),
  getHabitLog: (from: string, to: string) => request(`/habits/log?from=${from}&to=${to}`),
  toggleHabit: (habitId: string, date: string, done: boolean) =>
    request("/habits/log", { method: "PUT", body: JSON.stringify({ habitId, date, done }) }),

  getTriggers: () => request("/triggers"),
  addTrigger: (label: string) => request("/triggers", { method: "POST", body: JSON.stringify({ label }) }),
  toggleTrigger: (triggerId: string, removed: boolean) =>
    request("/triggers/toggle", { method: "PUT", body: JSON.stringify({ triggerId, removed }) }),

  getEnergy: (from: string, to: string) => request(`/energy?from=${from}&to=${to}`),
  setEnergy: (date: string, hour: number, value: number) =>
    request("/energy", { method: "PUT", body: JSON.stringify({ date, hour, value }) }),

  getSessions: (from: string, to: string) => request(`/sessions?from=${from}&to=${to}`),
  addSession: (date: string, durationMin: number) =>
    request("/sessions", { method: "POST", body: JSON.stringify({ date, durationMin }) }),

  getQuestion: (from: string, to: string) => request(`/question?from=${from}&to=${to}`),
  setQuestion: (date: string, text: string) =>
    request("/question", { method: "PUT", body: JSON.stringify({ date, text }) }),

  registerPushToken: (expoToken: string, deviceId: string, platform: "ios" | "android") =>
    request("/push/register", { method: "POST", body: JSON.stringify({ expoToken, deviceId, platform }) }),
  setReminder: (hour: number, minute: number, timezone: string, enabled: boolean) =>
    request("/push/reminder", { method: "PUT", body: JSON.stringify({ hour, minute, timezone, enabled }) }),
};

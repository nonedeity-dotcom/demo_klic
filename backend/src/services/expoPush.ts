// Thin wrapper around Expo's push API. No SDK dependency needed — it's a
// plain HTTPS POST, which keeps this file dependency-free and easy to test.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string; // "ExponentPushToken[xxxxxxxx]"
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPush(messages: ExpoPushMessage[]) {
  if (messages.length === 0) return;
  // Expo accepts batches of up to 100 messages per request.
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("Expo push send failed", res.status, await res.text());
    }
  }
}

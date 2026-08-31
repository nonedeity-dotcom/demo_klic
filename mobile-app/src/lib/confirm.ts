import { Alert, Platform } from "react-native";

/**
 * Yes/no confirmation for destructive actions.
 *
 * `Alert.alert` is the right native control, but react-native-web ships it as
 * an empty no-op (`static alert() {}`) — using it directly would leave the
 * delete buttons doing literally nothing in the web build. Native keeps the
 * real dialog; the web build falls back to `window.confirm`.
 */
export function confirmDestructive(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = "Удалить",
): void {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: "Отмена", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

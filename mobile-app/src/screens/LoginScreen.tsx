import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../hooks/useAuth";

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (e) {
      setError(mode === "login" ? "Неверный email или пароль" : "Не удалось зарегистрироваться");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Меньше шума,{"\n"}больше стабильности</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="email"
        placeholderTextColor="#5a5f68"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="пароль"
        placeholderTextColor="#5a5f68"
        secureTextEntry
        style={styles.input}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={submit} disabled={busy} style={styles.submitBtn}>
        <Text style={styles.submitBtnText}>{mode === "login" ? "Войти" : "Создать аккаунт"}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
        <Text style={styles.switchText}>
          {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 24 },
  title: { color: colors.text, fontSize: 26, fontWeight: "700", marginBottom: 32 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
    marginBottom: 12,
  },
  error: { color: colors.accent, fontSize: 12, marginBottom: 12 },
  submitBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: colors.bg, fontWeight: "600", fontSize: 15 },
  switchText: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 20 },
});

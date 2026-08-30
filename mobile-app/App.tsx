import { QueryClientProvider } from "@tanstack/react-query";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { queryClient } from "./src/api/queryClient";
import { useAuth } from "./src/hooks/useAuth";
import { colors } from "./src/theme/colors";
import LoginScreen from "./src/screens/LoginScreen";
import RootTabs from "./src/navigation/RootTabs";

function Gate() {
  const { loggedIn } = useAuth();

  if (loggedIn === null) {
    // still reading the token from secure storage
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return loggedIn ? <RootTabs /> : <LoginScreen />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Gate />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});

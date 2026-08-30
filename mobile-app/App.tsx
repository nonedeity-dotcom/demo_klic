import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/api/queryClient";
import RootTabs from "./src/navigation/RootTabs";
import { restoreReminder } from "./src/notifications/reminders";

export default function App() {
  useEffect(() => {
    restoreReminder();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RootTabs />
    </QueryClientProvider>
  );
}

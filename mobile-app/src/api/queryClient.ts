import { QueryClient } from "@tanstack/react-query";

// react-query replaces the old useState+useEffect+window.storage.get dance
// from the demo: it gives caching, refetch-on-focus, and optimistic updates
// for free, which matters once data lives on a server instead of on-device.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

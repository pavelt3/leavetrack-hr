import { QueryClient } from "@tanstack/react-query";

const API_BASE =
  typeof window !== "undefined" && (window as any).__PORT_5000__
    ? (window as any).__PORT_5000__
    : "";

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  return res;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [path] = queryKey as string[];
        const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "Request failed");
        }
        return res.json();
      },
      staleTime: 30_000,
      retry: false,
    },
  },
});

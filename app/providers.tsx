"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { PwaProvider } from "@/components/pwa-provider";
import { StatistikPerangkat } from "@/components/statistik-perangkat";
import { ThemeColorMeta } from "@/components/theme-color-meta";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  /** Nonce CSP per-request — skrip anti-kedip tema next-themes wajib membawanya. */
  nonce?: string;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
      <QueryClientProvider client={queryClient}>
        <ThemeColorMeta />
        <PwaProvider />
        <StatistikPerangkat />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}

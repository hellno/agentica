"use client";

import { MiniKitProvider as WorldMiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { ReactNode } from "react";

export function MiniKitProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_WORLD_ID;

  if (!appId) {
    console.warn(
      "[MiniKitProvider] NEXT_PUBLIC_WORLD_ID not found in environment variables"
    );
    // Return children without wrapping if no app ID is configured
    return <>{children}</>;
  }

  return (
    <WorldMiniKitProvider props={{ appId }}>
      {children}
    </WorldMiniKitProvider>
  );
}

"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export function FarcasterInit() {
  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        // Signal that the app is ready to be displayed
        await sdk.actions.ready();
        console.log("[FarcasterInit] SDK ready signal sent");
      } catch (error) {
        console.error("[FarcasterInit] Error initializing Farcaster SDK:", error);
      }
    };

    initializeFarcaster();
  }, []);

  // This component doesn't render anything
  return null;
}

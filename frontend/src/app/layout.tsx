import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";

import { siteConfig } from "@/app/constants";
import { inter } from "@/app/fonts";
import "@/app/globals.css";
import { FarcasterInit } from "@/app/farcaster-init";
import { MiniKitProvider } from "@/app/minikit-provider";
import { ProgressBar } from "@/app/progress-bar";
import { Toaster } from "@/app/toaster";
import { Header } from "@/components/header";

import { Archivo_Black, Space_Grotesk } from "next/font/google";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-head",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "white",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${siteConfig.name}`,
  description: siteConfig.description,
  openGraph: {
    siteName: siteConfig.name,
    title: "agentica",
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    type: "website",
    url: siteConfig.url,
    locale: "en_US",
  },
  icons: siteConfig.icons,
  twitter: {
    card: "summary_large_image",
    site: siteConfig.name,
    title: "agentica",
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: siteConfig.creator,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="en" className={inter.className}>
      <body
        className={`${archivoBlack.variable} ${space.variable} antialiased bg-white text-black scheme-light dark:bg-black dark:text-white dark:scheme-dark selection:!bg-[#fff0dd] dark:selection:!bg-[#3d2b15] overscroll-none`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MiniKitProvider>{children}</MiniKitProvider>
        </ThemeProvider>
        <FarcasterInit />
        <ProgressBar />
        <Toaster />
      </body>
    </html>
  );
}

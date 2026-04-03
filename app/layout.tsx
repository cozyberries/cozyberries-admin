import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AdminAuthProvider } from "@/components/supabase-auth-provider";
import { Toaster } from "sonner";
import { ReactQueryProvider } from "@/components/query-provider";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { PwaServiceWorkerRegister } from "@/components/pwa-service-worker-register";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#292524",
};

export const metadata: Metadata = {
  title: "CozyBerries Admin | Admin Panel",
  description: "Admin panel for CozyBerries e-commerce platform",
  appleWebApp: {
    capable: true,
    title: "CozyBerries Admin",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AdminAuthProvider>
          <PwaServiceWorkerRegister />
          <PwaInstallBanner />
          <ReactQueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </ReactQueryProvider>
        </AdminAuthProvider>
      </body>
    </html>
  );
}

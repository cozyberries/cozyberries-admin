"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Package,
  Users,
  ShoppingCart,
  LogOut,
  Receipt,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/supabase-auth-provider";
import NotificationCenter from "@/components/NotificationCenter";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const adminNavItems = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Products", href: "/products", icon: Package },
  { name: "Users", href: "/users", icon: Users },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Notifications", href: "/notifications", icon: Bell },
];

function pageTitle(pathname: string): string {
  const match = adminNavItems.find((item) => item.href === pathname);
  return match?.name ?? "Admin";
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      const result = await signOut();
      if (result.success) {
        window.location.href = "/";
      } else {
        alert("Logout failed. Please try again.");
      }
    } catch {
      alert("Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <div
        className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col"
        data-testid="sidebar-desktop"
      >
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex h-16 items-center px-5 border-b border-gray-100">
            <Link href="/" className="min-w-0 shrink">
              <Image
                src="/logo.png"
                alt="Cozyberries"
                width={120}
                height={40}
                className="object-contain"
              />
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="mr-3 h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User + sign-out */}
          <div className="border-t border-gray-100 p-4 space-y-3">
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center text-sm"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoggingOut ? "Signing Out…" : "Sign Out"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main area (sidebar offset on desktop) ────────────────── */}
      <div className="lg:pl-64">
        {/* ── Desktop top header ── */}
        <div
          className="hidden lg:flex sticky top-0 z-40 h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm"
          data-testid="desktop-header"
        >
          <h1 className="text-base font-semibold text-gray-800 tracking-tight">
            {pageTitle(pathname)}
          </h1>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <div className="h-6 w-px bg-gray-200" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              aria-label="Sign out"
              className="text-gray-500 hover:text-gray-800 gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline text-sm">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* ── Mobile top header ── */}
        <div
          className="sticky top-0 z-40 lg:hidden"
          data-testid="mobile-header"
        >
          <div className="flex items-center justify-between h-14 bg-white px-4 border-b border-gray-200 shadow-sm gap-2">
            <Link href="/" className="min-w-0 shrink">
              <Image
                src="/logo.png"
                alt="Cozyberries"
                width={90}
                height={30}
                className="object-contain"
              />
            </Link>
            <div className="flex items-center gap-1">
              <NotificationCenter />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                aria-label="Sign out"
                className="shrink-0 h-9 w-9"
              >
                <LogOut className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Page content ── */}
        <main className="flex-1">
          <div className="py-4 sm:py-6 pb-24 lg:pb-8">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">{children}</div>
          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 lg:hidden"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex safe-area-inset-bottom">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                  isActive ? "text-blue-600" : "text-gray-400"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/supabase-auth-provider";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const adminNavItems = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Products", href: "/products", icon: Package },
  { name: "Users", href: "/users", icon: Users },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Expenses", href: "/expenses", icon: Receipt },
];

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
      {/* Desktop sidebar */}
      <div
        className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col"
        data-testid="sidebar-desktop"
      >
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Cozyberries"
                width={120}
                height={40}
                className="object-contain"
              />
            </Link>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-gray-200 p-4">
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoggingOut ? "Signing Out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className="sticky top-0 z-40 lg:hidden" data-testid="mobile-header">
          <div className="flex items-center justify-between h-16 bg-white px-4 shadow-sm">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Cozyberries"
                width={100}
                height={32}
                className="object-contain"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5 text-gray-500" />
            </Button>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-4 sm:py-6 pb-24 lg:pb-6">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">{children}</div>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
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
                className={`flex flex-1 flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                  isActive ? "text-blue-600" : "text-gray-500"
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

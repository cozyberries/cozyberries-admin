"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Package,
  Users,
  ShoppingCart,
  Settings,
  Menu,
  X,
  LogOut,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/supabase-auth-provider";
import NotificationCenter from "../NotificationCenter";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const adminNavItems = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Products", href: "/products", icon: Package },
  { name: "Users", href: "/users", icon: Users },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      console.log("Admin logout initiated");
      const result = await signOut();
      console.log("Admin logout result:", result);

      if (result.success) {
        window.location.href = "/";
      } else {
        console.error("Logout failed:", result.error);
        alert("Logout failed. Please try again.");
      }
    } catch (error) {
      console.error("Logout error:", error);
      alert("Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "block" : "hidden"
          }`}
      >
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  onClick={() => setSidebarOpen(false)}
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

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex justify-between h-16 items-center px-4">
            <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
            <NotificationCenter />
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
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
        <div className="sticky top-0 z-40 lg:hidden">
          <div className="flex h-16 items-center justify-between bg-white px-4 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
            <div className="flex items-center space-x-2">
              <NotificationCenter />
              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  aria-label="Open Settings"
                  title="Settings"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

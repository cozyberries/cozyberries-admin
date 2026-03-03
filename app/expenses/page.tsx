"use client";

import { useAuth } from "@/components/supabase-auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ExpenseManagement from "@/components/admin/ExpenseManagement";
import ExpenseAnalytics from "@/components/admin/ExpenseAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BarChart3, List } from "lucide-react";

export default function AdminExpensesPage() {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("list");

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login?redirect=/expenses");
      } else if (!isAdmin) {
        router.push("/");
      }
    }
  }, [loading, isAuthenticated, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  return (
    <AdminLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Expense Management</h1>
            <p className="text-xs text-gray-400">Track and manage company expenses</p>
          </div>
          <TabsList className="h-9">
            <TabsTrigger value="list" className="text-xs px-3">
              <List className="h-3.5 w-3.5 mr-1.5" />
              List
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs px-3">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list">
          <ExpenseManagement />
        </TabsContent>

        <TabsContent value="analytics">
          <ExpenseAnalytics />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

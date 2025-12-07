"use client";

import { useAuth } from "@/components/supabase-auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ExpenseManagement from "@/components/admin/ExpenseManagement";
import ExpenseAnalytics from "@/components/admin/ExpenseAnalytics";
import ExpenseForm from "@/components/admin/ExpenseForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Shield,
  AlertTriangle,
  Loader2,
  Plus,
  BarChart3,
  List,
} from "lucide-react";

export default function AdminExpensesPage() {
  const { user, loading, isAuthenticated, isAdmin, userProfile } = useAuth();
  const router = useRouter();
  const [accessDenied, setAccessDenied] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("list");

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login?redirect=/admin/expenses");
        return;
      }

      if (!isAdmin) {
        setAccessDenied(true);
        return;
      }

      setAccessDenied(false);
    }
  }, [loading, isAuthenticated, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-lg">Loading expense management...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold text-red-600">
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access expense management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Admin privileges are required to access this page. Your current
                role is: <strong>{userProfile?.role || "customer"}</strong>
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">
                If you believe this is an error, please contact your system
                administrator.
              </p>

              <div className="flex space-x-3">
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="flex-1"
                >
                  Go Home
                </Button>
                <Button
                  onClick={() => router.push("/admin")}
                  className="flex-1"
                >
                  Admin Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    // Refresh the expense list by switching tabs or triggering a refetch
    if (activeTab === "analytics") {
      setActiveTab("list");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Expense Management</h1>
            <p className="text-gray-600">
              Manage company expenses, approvals, and analytics
            </p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list" className="flex items-center">
              <List className="mr-2 h-4 w-4" />
              Expense List
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            <ExpenseManagement />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <ExpenseAnalytics />
          </TabsContent>
        </Tabs>

        {/* Create Expense Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Expense</DialogTitle>
              <DialogDescription>
                Add a new expense entry to the system
              </DialogDescription>
            </DialogHeader>
            <ExpenseForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

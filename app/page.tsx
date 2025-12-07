"use client";

import { useAuth } from "@/components/supabase-auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";

export default function AdminPage() {
  const { user, loading, isAuthenticated, isAdmin, userProfile, signOut } = useAuth();
  const router = useRouter();
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login?redirect=/");
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
          <span className="text-lg">Verifying admin access...</span>
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
              You don't have permission to access the admin panel
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
                  onClick={() => router.push("/login")}
                  variant="outline"
                  className="flex-1"
                >
                  Go Back
                </Button>
                <Button
                  onClick={async () => {
                    await signOut();
                    router.push("/login");
                  }}
                  className="flex-1"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <AnalyticsDashboard />
    </AdminLayout>
  );
}

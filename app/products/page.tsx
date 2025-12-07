"use client";

import { useAuth } from "@/components/supabase-auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ProductManagement from "@/components/admin/ProductManagement";

export default function AdminProductsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AdminLayout>
      <ProductManagement />
    </AdminLayout>
  );
}

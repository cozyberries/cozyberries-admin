"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  MoreHorizontal,
  UserX,
  Phone,
  Mail,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";

interface User {
  id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  is_active?: boolean;
  is_verified?: boolean;
  order_count?: number;
  total_spent?: number;
}

function UserAvatar({ user }: { user: User }) {
  const initials = user.full_name
    ? user.full_name.trim().split(/\s+/).filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : (user.email?.trim().charAt(0) ?? "?").toUpperCase();
  return (
    <div className="h-10 w-10 flex-shrink-0 bg-rose-100 rounded-full flex items-center justify-center">
      <span className="text-sm font-semibold text-rose-700">{initials}</span>
    </div>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { get } = useAuthenticatedFetch();
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [get]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await get("/api/users", {
        requireAuth: true,
        requireAdmin: true,
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error("Failed to fetch users:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(term) ||
      user.full_name?.toLowerCase().includes(term) ||
      user.phone?.includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your customer accounts</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search by name, email or phone…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* User count */}
      <p className="text-sm text-gray-500">
        {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"}
      </p>

      {/* User List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No users found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm ? "Try a different search term" : "No users have registered yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-3 lg:hidden">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <UserAvatar user={user} />
                    <div className="flex-1 min-w-0">
                      {/* Name + status */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900 truncate">
                          {user.full_name || "—"}
                        </p>
                        <Badge
                          variant="secondary"
                          className={
                            user.email_confirmed_at || user.is_verified
                              ? "bg-green-100 text-green-700 text-xs flex-shrink-0"
                              : "bg-yellow-100 text-yellow-700 text-xs flex-shrink-0"
                          }
                        >
                          {user.email_confirmed_at || user.is_verified ? "Verified" : "Pending"}
                        </Badge>
                      </div>

                      {/* Email */}
                      {user.email && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-600 truncate">{user.email}</span>
                        </div>
                      )}

                      {/* Phone */}
                      {user.phone && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-600">{user.phone}</span>
                        </div>
                      )}

                      {/* ID (optional, greyed) */}
                      <p className="text-xs text-gray-300 mt-1 font-mono">
                        {user.id.slice(0, 8)}…
                      </p>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(user.order_count ?? 0) > 0 && (
                          <DropdownMenuItem
                            onClick={() => router.push(`/orders?search=${encodeURIComponent(user.email ?? user.id)}`)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            View Orders ({user.order_count})
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-red-600">
                          <UserX className="h-4 w-4 mr-2" />
                          Suspend User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Order count pill if any */}
                  {(user.order_count ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span>{user.order_count} order{user.order_count !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden lg:block">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">All Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">User</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Phone</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Orders</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div>
                              <p className="font-medium text-gray-900">{user.full_name || "—"}</p>
                              <p className="text-xs text-gray-300 font-mono">{user.id.slice(0, 8)}…</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-700">{user.email || "—"}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-700">{user.phone || "—"}</span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge
                            variant="secondary"
                            className={
                              user.email_confirmed_at || user.is_verified
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }
                          >
                            {user.email_confirmed_at || user.is_verified ? "Verified" : "Pending"}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <ShoppingCart className="h-4 w-4" />
                            {user.order_count ?? 0}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(user.order_count ?? 0) > 0 && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(
                                      `/orders?search=${encodeURIComponent(user.email ?? user.id)}`
                                    )
                                  }
                                >
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  View Orders ({user.order_count})
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-red-600">
                                <UserX className="h-4 w-4 mr-2" />
                                Suspend User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Mail, 
  Calendar,
  ShoppingCart,
  MoreHorizontal,
  UserCheck,
  UserX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  order_count?: number;
  total_spent?: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { get } = useAuthenticatedFetch();

  useEffect(() => {
    fetchUsers();
  }, [get]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await get('/api/admin/users', { requireAuth: true, requireAdmin: true });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        const errorData = await response.text();
        console.error('Failed to fetch users:', response.status, response.statusText, errorData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-1">Manage your users and their activity</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search users by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Joined</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Last Active</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Orders</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Total Spent</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.email}</p>
                            <p className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge 
                          variant={user.email_confirmed_at ? "default" : "secondary"}
                          className={user.email_confirmed_at ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {user.email_confirmed_at ? "Verified" : "Pending"}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(user.created_at)}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-gray-600">
                          {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Never"}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          {user.order_count || 0}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.total_spent ? formatCurrency(user.total_spent) : "₹0"}
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
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <UserCheck className="h-4 w-4 mr-2" />
                              View Orders
                            </DropdownMenuItem>
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
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Mail className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500">
                {searchTerm ? 'Try adjusting your search terms' : 'No users have registered yet'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

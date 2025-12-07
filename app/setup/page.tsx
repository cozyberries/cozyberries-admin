"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, CheckCircle } from "lucide-react";

export default function AdminSetupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch("/api/admin/setup");
      const data = await response.json();
      
      if (response.ok) {
        setNeedsSetup(data.needsSetup);
        if (!data.needsSetup) {
          // Admin already exists, redirect to admin login
          router.push("/admin");
        }
      } else {
        setError("Failed to check setup status");
      }
    } catch (err) {
      setError("Failed to check setup status");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          setupKey,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Store the admin token temporarily
        localStorage.setItem("admin_token", data.token);
        
        setTimeout(() => {
          router.push("/admin");
        }, 2000);
      } else {
        setError(data.error || "Failed to create admin user");
      }
    } catch (err) {
      setError("Failed to create admin user");
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Checking setup status...</span>
        </div>
      </div>
    );
  }

  if (!needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Setup Complete</CardTitle>
            <CardDescription>
              Admin user already exists. Redirecting to admin panel...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Setup Successful!</CardTitle>
            <CardDescription>
              Admin user created successfully. Redirecting to admin panel...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold">Admin Setup</CardTitle>
          <CardDescription>
            Create the initial administrator account for your application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="setupKey" className="block text-sm font-medium text-gray-700 mb-1">
                Setup Key
              </label>
              <Input
                id="setupKey"
                type="password"
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
                placeholder="Enter setup key"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Contact your system administrator for the setup key
              </p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Admin Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password"
                minLength={8}
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                minLength={8}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Admin...
                </>
              ) : (
                "Create Admin User"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              This page will be disabled after the first admin user is created
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

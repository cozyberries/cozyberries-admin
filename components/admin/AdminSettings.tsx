"use client";

import { useState } from "react";
import { 
  Database, 
  Mail, 
  Shield, 
  Bell,
  Save,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    // General Settings
    siteName: "CozyBerries",
    siteDescription: "Premium Baby Clothing Store",
    siteUrl: "https://cozyberries.com",
    
    // Email Settings
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "noreply@cozyberries.com",
    
    // Security Settings
    enableTwoFactor: false,
    sessionTimeout: "24",
    maxLoginAttempts: "5",
    
    // Notification Settings
    emailNotifications: true,
    orderNotifications: true,
    userNotifications: true,
    systemNotifications: false,
    
    // Database Settings
    backupFrequency: "daily",
    retentionDays: "30",
    enableLogging: true,
  });

  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Settings saved successfully!');
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    // Simulate refreshing settings from server
    alert('Settings refreshed from server');
  };

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
          <p className="text-gray-600 mt-1">Configure your admin panel and system settings</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            General Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="siteName">Site Name</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) => handleInputChange('siteName', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="siteUrl">Site URL</Label>
              <Input
                id="siteUrl"
                value={settings.siteUrl}
                onChange={(e) => handleInputChange('siteUrl', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="siteDescription">Site Description</Label>
            <Textarea
              id="siteDescription"
              value={settings.siteDescription}
              onChange={(e) => handleInputChange('siteDescription', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Email Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                value={settings.smtpHost}
                onChange={(e) => handleInputChange('smtpHost', e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label htmlFor="smtpPort">SMTP Port</Label>
              <Input
                id="smtpPort"
                value={settings.smtpPort}
                onChange={(e) => handleInputChange('smtpPort', e.target.value)}
                placeholder="587"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtpUser">SMTP Username</Label>
              <Input
                id="smtpUser"
                value={settings.smtpUser}
                onChange={(e) => handleInputChange('smtpUser', e.target.value)}
                placeholder="your-email@gmail.com"
              />
            </div>
            <div>
              <Label htmlFor="smtpPassword">SMTP Password</Label>
              <Input
                id="smtpPassword"
                type="password"
                value={settings.smtpPassword}
                onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
                placeholder="App password"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="fromEmail">From Email</Label>
            <Input
              id="fromEmail"
              value={settings.fromEmail}
              onChange={(e) => handleInputChange('fromEmail', e.target.value)}
              placeholder="noreply@cozyberries.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enableTwoFactor">Enable Two-Factor Authentication</Label>
              <p className="text-sm text-gray-500">Require 2FA for admin access</p>
            </div>
            <Switch
              id="enableTwoFactor"
              checked={settings.enableTwoFactor}
              onCheckedChange={(checked) => handleInputChange('enableTwoFactor', checked)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => handleInputChange('sessionTimeout', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
              <Input
                id="maxLoginAttempts"
                type="number"
                value={settings.maxLoginAttempts}
                onChange={(e) => handleInputChange('maxLoginAttempts', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <p className="text-sm text-gray-500">Send email notifications for important events</p>
              </div>
              <Switch
                id="emailNotifications"
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="orderNotifications">Order Notifications</Label>
                <p className="text-sm text-gray-500">Notify on new orders and status changes</p>
              </div>
              <Switch
                id="orderNotifications"
                checked={settings.orderNotifications}
                onCheckedChange={(checked) => handleInputChange('orderNotifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="userNotifications">User Notifications</Label>
                <p className="text-sm text-gray-500">Notify on new user registrations</p>
              </div>
              <Switch
                id="userNotifications"
                checked={settings.userNotifications}
                onCheckedChange={(checked) => handleInputChange('userNotifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="systemNotifications">System Notifications</Label>
                <p className="text-sm text-gray-500">Notify on system errors and maintenance</p>
              </div>
              <Switch
                id="systemNotifications"
                checked={settings.systemNotifications}
                onCheckedChange={(checked) => handleInputChange('systemNotifications', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Database Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="backupFrequency">Backup Frequency</Label>
              <select
                id="backupFrequency"
                value={settings.backupFrequency}
                onChange={(e) => handleInputChange('backupFrequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <Label htmlFor="retentionDays">Retention Days</Label>
              <Input
                id="retentionDays"
                type="number"
                value={settings.retentionDays}
                onChange={(e) => handleInputChange('retentionDays', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enableLogging">Enable Logging</Label>
              <p className="text-sm text-gray-500">Log all admin activities</p>
            </div>
            <Switch
              id="enableLogging"
              checked={settings.enableLogging}
              onCheckedChange={(checked) => handleInputChange('enableLogging', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

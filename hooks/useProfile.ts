"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { validatePhoneNumber, validateFullName } from "@/lib/utils/validation";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  updated_at: string;
}

interface UserAddress {
  id: string;
  user_id: string;
  address_type: string;
  label: string | null;
  full_name: string | null;
  phone: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProfile(user: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);

  const [editData, setEditData] = useState({
    full_name: "",
    phone: "",
  });

  const [validationErrors, setValidationErrors] = useState({
    full_name: "",
    phone: "",
  });

  const [addressData, setAddressData] = useState({
    address_type: "home" as const,
    label: "",
    full_name: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    is_default: false,
  });

  const [addressValidationErrors, setAddressValidationErrors] = useState({
    full_name: "",
    phone: "",
    address_line_1: "",
    city: "",
    state: "",
    postal_code: "",
  });

  // Fetch profile data and addresses using combined endpoint for better performance
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Use combined endpoint to fetch both profile and addresses in a single request
        const response = await fetch("/api/profile/combined");

        if (response.ok) {
          const data = await response.json();
          
          // Set profile data
          if (data.profile) {
            setProfile(data.profile);
            setEditData({
              full_name: data.profile.full_name || "",
              phone: data.profile.phone || "",
            });
          }

          // Set addresses data
          setAddresses(data.addresses || []);
        } else {
          // Fallback to separate endpoints if combined endpoint fails
          console.warn("Combined endpoint failed, falling back to separate endpoints");
          const [profileResponse, addressesResponse] = await Promise.all([
            fetch("/api/profile"),
            fetch("/api/profile/addresses"),
          ]);

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            setProfile(profileData);
            setEditData({
              full_name: profileData.full_name || "",
              phone: profileData.phone || "",
            });
          }

          if (addressesResponse.ok) {
            const addressesData = await addressesResponse.json();
            setAddresses(addressesData);
          } else {
            setAddresses([]);
          }
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
        setAddresses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const validateField = (field: string, value: string) => {
    let error = "";

    if (field === "full_name" && value) {
      const validation = validateFullName(value);
      if (!validation.isValid) {
        error = validation.error || "";
      }
    }

    if (field === "phone" && value) {
      const validation = validatePhoneNumber(value);
      if (!validation.isValid) {
        error = validation.error || "";
      }
    }

    setValidationErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));

    validateField(field, value);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        setIsEditing(false);
        setValidationErrors({ full_name: "", phone: "" });
      } else {
        const errorData = await response.json();
        alert(`Failed to update profile: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditData({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
      });
    }
    setValidationErrors({ full_name: "", phone: "" });
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleAddAddress = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(addressData),
      });

      if (response.ok) {
        const newAddress = await response.json();
        setAddresses((prev) => [...prev, newAddress]);
        setShowAddAddress(false);
        setAddressData({
          address_type: "home",
          label: "",
          full_name: "",
          phone: "",
          address_line_1: "",
          address_line_2: "",
          city: "",
          state: "",
          postal_code: "",
          country: "India",
          is_default: false,
        });
        setAddressValidationErrors({
          full_name: "",
          phone: "",
          address_line_1: "",
          city: "",
          state: "",
          postal_code: "",
        });
      } else {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes("does not exist")) {
          alert(
            "Addresses table not created yet. Please run the database migration first. See MULTIPLE_ADDRESSES_SETUP.md for instructions."
          );
        } else {
          alert(`Failed to add address: ${errorData.error || "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error("Error adding address:", error);
      alert("Failed to add address. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAddress = async (addressId: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/profile/addresses/${addressId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(addressData),
      });

      if (response.ok) {
        const updatedAddress = await response.json();
        setAddresses((prev) =>
          prev.map((addr) => (addr.id === addressId ? updatedAddress : addr))
        );
        setEditingAddress(null);
        setAddressData({
          address_type: "home",
          label: "",
          full_name: "",
          phone: "",
          address_line_1: "",
          address_line_2: "",
          city: "",
          state: "",
          postal_code: "",
          country: "India",
          is_default: false,
        });
        setAddressValidationErrors({
          full_name: "",
          phone: "",
          address_line_1: "",
          city: "",
          state: "",
          postal_code: "",
        });
      } else {
        const errorData = await response.json();
        alert(`Failed to update address: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error updating address:", error);
      alert("Failed to update address. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;

    try {
      const response = await fetch(`/api/profile/addresses/${addressId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAddresses((prev) => prev.filter((addr) => addr.id !== addressId));
      } else {
        const errorData = await response.json();
        alert(`Failed to delete address: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error deleting address:", error);
      alert("Failed to delete address. Please try again.");
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      // Find the address to get its complete data
      const addressToUpdate = addresses.find(addr => addr.id === addressId);
      if (!addressToUpdate) {
        alert("Address not found. Please refresh and try again.");
        return;
      }

      // Send complete address data with is_default set to true
      const updateData = {
        address_type: addressToUpdate.address_type,
        label: addressToUpdate.label,
        full_name: addressToUpdate.full_name,
        phone: addressToUpdate.phone,
        address_line_1: addressToUpdate.address_line_1,
        address_line_2: addressToUpdate.address_line_2,
        city: addressToUpdate.city,
        state: addressToUpdate.state,
        postal_code: addressToUpdate.postal_code,
        country: addressToUpdate.country,
        is_default: true,
      };

      const response = await fetch(`/api/profile/addresses/${addressId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedAddress = await response.json();
        setAddresses((prev) =>
          prev.map((addr) => ({
            ...addr,
            is_default: addr.id === addressId,
          }))
        );
      } else {
        const errorData = await response.json();
        alert(`Failed to set default address: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error setting default address:", error);
      alert("Failed to set default address. Please try again.");
    }
  };

  const handleEditAddress = (address: UserAddress) => {
    setEditingAddress(address.id);
    setAddressData({
      address_type: address.address_type as any,
      label: address.label || "",
      full_name: address.full_name || "",
      phone: address.phone || "",
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 || "",
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
      is_default: address.is_default,
    });
  };

  const handleCloseAddressModal = () => {
    setShowAddAddress(false);
    setEditingAddress(null);
    setAddressData({
      address_type: "home",
      label: "",
      full_name: "",
      phone: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "India",
      is_default: false,
    });
    setAddressValidationErrors({
      full_name: "",
      phone: "",
      address_line_1: "",
      city: "",
      state: "",
      postal_code: "",
    });
  };

  return {
    profile,
    addresses,
    isLoading,
    isSaving,
    isEditing,
    showAddAddress,
    editingAddress,
    editData,
    validationErrors,
    addressData,
    addressValidationErrors,
    handleInputChange,
    handleSave,
    handleCancel,
    handleEdit,
    handleAddAddress,
    handleUpdateAddress,
    handleDeleteAddress,
    handleSetDefault,
    handleEditAddress,
    handleCloseAddressModal,
    setShowAddAddress,
    setAddressData,
    setAddressValidationErrors,
  };
}

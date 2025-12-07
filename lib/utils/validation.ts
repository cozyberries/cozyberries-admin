// Validation utilities for forms and data

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Phone number validation
export const validatePhoneNumber = (phone: string): ValidationResult => {
  if (!phone || phone.trim() === "") {
    return { isValid: true }; // Phone is optional
  }

  // Remove all non-digit characters for validation
  const cleanPhone = phone.replace(/\D/g, "");

  // For Indian phone numbers, require exactly 10 digits
  if (cleanPhone.length === 10) {
    // Check for common invalid patterns
    if (/^(\d)\1+$/.test(cleanPhone)) {
      return {
        isValid: false,
        error: "Phone number cannot be all the same digits",
      };
    }

    // Check if it starts with valid Indian mobile prefixes
    const validPrefixes = ["6", "7", "8", "9"]; // Indian mobile number prefixes
    if (!validPrefixes.includes(cleanPhone[0])) {
      return {
        isValid: false,
        error: "Indian mobile numbers must start with 6, 7, 8, or 9",
      };
    }

    return { isValid: true };
  }

  // For international numbers, allow 7-15 digits
  if (cleanPhone.length >= 7 && cleanPhone.length <= 15) {
    // Check for common invalid patterns
    if (/^(\d)\1+$/.test(cleanPhone)) {
      return {
        isValid: false,
        error: "Phone number cannot be all the same digits",
      };
    }

    // Check for valid international format (starts with country code)
    if (
      cleanPhone.length > 10 &&
      !cleanPhone.startsWith("1") &&
      !cleanPhone.startsWith("91")
    ) {
      return {
        isValid: false,
        error: "Invalid international phone number format",
      };
    }

    return { isValid: true };
  }

  // Invalid length
  return {
    isValid: false,
    error:
      "Phone number must be 10 digits (Indian) or 7-15 digits (international)",
  };
};

// Format phone number for display
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return "";

  const cleanPhone = phone.replace(/\D/g, "");

  // Format based on length
  if (cleanPhone.length === 10) {
    // Indian format: +91 98765 43210
    return `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`;
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
    // India format with country code: +91 98765 43210
    return `+91 ${cleanPhone.slice(2, 7)} ${cleanPhone.slice(7)}`;
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) {
    // US format with country code: +1 (123) 456-7890
    return `+1 (${cleanPhone.slice(1, 4)}) ${cleanPhone.slice(
      4,
      7
    )}-${cleanPhone.slice(7)}`;
  } else if (cleanPhone.length === 10 && cleanPhone.startsWith("1") === false) {
    // Assume Indian format for 10 digits not starting with 1
    return `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`;
  } else {
    // Generic international format
    return `+${cleanPhone}`;
  }
};

// Postal code validation
export const validatePostalCode = (
  postalCode: string,
  country: string = "India"
): ValidationResult => {
  if (!postalCode || postalCode.trim() === "") {
    return {
      isValid: false,
      error: "Postal code is required",
    };
  }

  const cleanPostalCode = postalCode.trim().toUpperCase();

  // India PIN code validation (default)
  if (country === "India" || country === "IN") {
    // India PIN: 6 digits
    const indiaPinRegex = /^\d{6}$/;
    if (!indiaPinRegex.test(cleanPostalCode)) {
      return {
        isValid: false,
        error: "Please enter a valid Indian PIN code (6 digits)",
      };
    }
  }
  // US ZIP code validation
  else if (country === "United States" || country === "US") {
    // US ZIP: 12345 or 12345-6789
    const usZipRegex = /^\d{5}(-\d{4})?$/;
    if (!usZipRegex.test(cleanPostalCode)) {
      return {
        isValid: false,
        error: "Please enter a valid US ZIP code (12345 or 12345-6789)",
      };
    }
  }
  // UK postal code validation
  else if (country === "United Kingdom" || country === "UK") {
    // UK: SW1A 1AA, M1 1AA, B33 8TH, W1A 0AX, EC1A 1BB
    const ukPostalRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    if (!ukPostalRegex.test(cleanPostalCode)) {
      return {
        isValid: false,
        error: "Please enter a valid UK postal code",
      };
    }
  }
  // Canada postal code validation
  else if (country === "Canada" || country === "CA") {
    // Canada: K1A 0A6, M5V 3A8
    const canadaPostalRegex = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;
    if (!canadaPostalRegex.test(cleanPostalCode)) {
      return {
        isValid: false,
        error: "Please enter a valid Canadian postal code",
      };
    }
  }
  // Generic validation for other countries
  else {
    // Allow alphanumeric postal codes, 3-10 characters
    const genericPostalRegex = /^[A-Z0-9\s-]{3,10}$/i;
    if (!genericPostalRegex.test(cleanPostalCode)) {
      return {
        isValid: false,
        error: "Please enter a valid postal code",
      };
    }
  }

  return { isValid: true };
};

// Format postal code for display
export const formatPostalCode = (
  postalCode: string,
  country: string = "India"
): string => {
  if (!postalCode) return "";

  const cleanPostalCode = postalCode.trim().toUpperCase();

  // India PIN formatting (default - no special formatting needed)
  if (country === "India" || country === "IN") {
    return cleanPostalCode;
  }
  // US ZIP formatting
  else if (country === "United States" || country === "US") {
    if (cleanPostalCode.length === 9 && !cleanPostalCode.includes("-")) {
      return `${cleanPostalCode.slice(0, 5)}-${cleanPostalCode.slice(5)}`;
    }
  }
  // UK postal code formatting
  else if (country === "United Kingdom" || country === "UK") {
    // Add space if missing: SW1A1AA -> SW1A 1AA
    if (cleanPostalCode.length === 6 && !cleanPostalCode.includes(" ")) {
      return `${cleanPostalCode.slice(0, 3)} ${cleanPostalCode.slice(3)}`;
    }
  }
  // Canada postal code formatting
  else if (country === "Canada" || country === "CA") {
    // Add space if missing: K1A0A6 -> K1A 0A6
    if (cleanPostalCode.length === 6 && !cleanPostalCode.includes(" ")) {
      return `${cleanPostalCode.slice(0, 3)} ${cleanPostalCode.slice(3)}`;
    }
  }

  return cleanPostalCode;
};

// Address validation
export const validateAddress = (address: string): ValidationResult => {
  if (!address || address.trim() === "") {
    return {
      isValid: false,
      error: "Address is required",
    };
  }

  const cleanAddress = address.trim();

  // Check minimum length
  if (cleanAddress.length < 5) {
    return {
      isValid: false,
      error: "Address must be at least 5 characters long",
    };
  }

  // Check maximum length
  if (cleanAddress.length > 200) {
    return {
      isValid: false,
      error: "Address must be less than 200 characters",
    };
  }

  // Check for valid characters (letters, numbers, spaces, common punctuation)
  const validAddressRegex = /^[a-zA-Z0-9\s.,#-]+$/;
  if (!validAddressRegex.test(cleanAddress)) {
    return {
      isValid: false,
      error: "Address contains invalid characters",
    };
  }

  return { isValid: true };
};

// City validation
export const validateCity = (city: string): ValidationResult => {
  if (!city || city.trim() === "") {
    return {
      isValid: false,
      error: "City is required",
    };
  }

  const cleanCity = city.trim();

  // Check minimum length
  if (cleanCity.length < 2) {
    return {
      isValid: false,
      error: "City must be at least 2 characters long",
    };
  }

  // Check maximum length
  if (cleanCity.length > 100) {
    return {
      isValid: false,
      error: "City must be less than 100 characters",
    };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  const validCityRegex = /^[a-zA-Z\s\-']+$/;
  if (!validCityRegex.test(cleanCity)) {
    return {
      isValid: false,
      error: "City can only contain letters, spaces, hyphens, and apostrophes",
    };
  }

  return { isValid: true };
};

// State validation
export const validateState = (state: string): ValidationResult => {
  if (!state || state.trim() === "") {
    return {
      isValid: false,
      error: "State is required",
    };
  }

  const cleanState = state.trim();

  // Check minimum length
  if (cleanState.length < 2) {
    return {
      isValid: false,
      error: "State must be at least 2 characters long",
    };
  }

  // Check maximum length
  if (cleanState.length > 100) {
    return {
      isValid: false,
      error: "State must be less than 100 characters",
    };
  }

  // Check for valid characters (letters, spaces, hyphens)
  const validStateRegex = /^[a-zA-Z\s\-]+$/;
  if (!validStateRegex.test(cleanState)) {
    return {
      isValid: false,
      error: "State can only contain letters, spaces, and hyphens",
    };
  }

  return { isValid: true };
};

// Full name validation
export const validateFullName = (name: string): ValidationResult => {
  if (!name || name.trim() === "") {
    return {
      isValid: true, // Name is optional
    };
  }

  const cleanName = name.trim();

  // Check minimum length
  if (cleanName.length < 2) {
    return {
      isValid: false,
      error: "Name must be at least 2 characters long",
    };
  }

  // Check maximum length
  if (cleanName.length > 100) {
    return {
      isValid: false,
      error: "Name must be less than 100 characters",
    };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes, periods)
  const validNameRegex = /^[a-zA-Z\s\-'.]+$/;
  if (!validNameRegex.test(cleanName)) {
    return {
      isValid: false,
      error:
        "Name can only contain letters, spaces, hyphens, apostrophes, and periods",
    };
  }

  return { isValid: true };
};

// Generate a name from email address
// Example: "vixogem911@izeao.com" -> "Vixon Gem
export const generateNameFromEmail = (email: string): string => {
  if (!email || !email.includes("@")) {
    return "User";
  }

  // Extract the part before @
  const username = email.split("@")[0].toLowerCase();

  // Remove trailing numbers
  const namePart = username.replace(/\d+$/, "");

  // If empty after removing numbers, use the original username
  if (!namePart) {
    return username.charAt(0).toUpperCase() + username.slice(1);
  }

  // If length is 6 or more, try to split into two words
  if (namePart.length >= 6) {
    // Split point: prefer 5 characters for first part if length is 7-8, otherwise split in middle
    let splitPoint: number;
    if (namePart.length === 7 || namePart.length === 8) {
      splitPoint = 5;
    } else if (namePart.length >= 9) {
      splitPoint = 5;
    } else {
      // For length 6, split in middle
      splitPoint = Math.floor(namePart.length / 2);
    }
    
    const firstPart = namePart.slice(0, splitPoint);
    const secondPart = namePart.slice(splitPoint);

    // Capitalize first letter of each part
    const capitalize = (str: string) =>
      str.charAt(0).toUpperCase() + str.slice(1);

    return `${capitalize(firstPart)} ${capitalize(secondPart)}`;
  }
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
};
-- Function to atomically insert a new address and ensure only one default per user
-- This prevents race conditions when setting is_default=true

CREATE OR REPLACE FUNCTION ensure_single_default_address(
  p_user_id UUID,
  p_address_type TEXT,
  p_label TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_address_line_1 TEXT,
  p_address_line_2 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_postal_code TEXT,
  p_country TEXT,
  p_is_default BOOLEAN,
  p_is_active BOOLEAN
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  address_type TEXT,
  label TEXT,
  full_name TEXT,
  phone TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  is_default BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  new_address_id UUID;
BEGIN
  -- If setting as default, first clear all other defaults for this user
  IF p_is_default = TRUE THEN
    UPDATE user_addresses
    SET is_default = FALSE, updated_at = NOW()
    WHERE user_addresses.user_id = p_user_id
      AND is_default = TRUE;
  END IF;

  -- Insert the new address
  INSERT INTO user_addresses (
    user_id,
    address_type,
    label,
    full_name,
    phone,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    country,
    is_default,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_address_type,
    p_label,
    p_full_name,
    p_phone,
    p_address_line_1,
    p_address_line_2,
    p_city,
    p_state,
    p_postal_code,
    p_country,
    p_is_default,
    p_is_active,
    NOW(),
    NOW()
  )
  RETURNING user_addresses.id INTO new_address_id;

  -- Return the newly created address
  RETURN QUERY
  SELECT
    user_addresses.id,
    user_addresses.user_id,
    user_addresses.address_type,
    user_addresses.label,
    user_addresses.full_name,
    user_addresses.phone,
    user_addresses.address_line_1,
    user_addresses.address_line_2,
    user_addresses.city,
    user_addresses.state,
    user_addresses.postal_code,
    user_addresses.country,
    user_addresses.is_default,
    user_addresses.is_active,
    user_addresses.created_at,
    user_addresses.updated_at
  FROM user_addresses
  WHERE user_addresses.id = new_address_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ensure_single_default_address TO authenticated;

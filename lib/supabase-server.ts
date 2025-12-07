import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for App Router
export const createServerSupabaseClient = async (cookieStore?: any) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined'
    });
    throw new Error(
      "Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file"
    );
  }

  // If no cookie store is provided, try to import next/headers with timeout
  if (!cookieStore) {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Use Promise.race to timeout cookie import if it's slow
      const cookiesImport = import("next/headers");
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Cookie import timeout')), 200);
      });

      // Race the promises and clear timeout immediately when cookiesImport resolves
      const result = await Promise.race([
        cookiesImport.then((module) => {
          // Clear timeout immediately when cookiesImport resolves first to prevent memory leak
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          return module;
        }),
        timeoutPromise
      ]);

      const { cookies } = result as any;
      cookieStore = await cookies();
    } catch (error) {
      // Clear timeout in case of error or timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // If next/headers is not available or timed out (e.g., in API routes),
      // fall back to service role key for faster operations
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        // Use service role key for faster auth operations in API routes
        return createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
      }

      // Last resort: create client without auth context
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    } finally {
      // Final cleanup to ensure timeout is cleared (defensive programming)
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: any[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: any) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};

// Admin Supabase client using service role key
export const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables for admin client. Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env.local file"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

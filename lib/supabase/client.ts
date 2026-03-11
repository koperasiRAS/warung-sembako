import { createBrowserClient } from '@supabase/ssr';

// Using any for simplicity - replace with proper Database type for production
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

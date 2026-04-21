import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from Server Component
          }
        },
      },
    }
  );
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error);
    return null;
  }

  return session;
}

export async function getUser() {
  const supabase = await createClient();
  // getUser() hits the Supabase Auth server to validate the session token,
  // preventing spoofed cookies that getSession() would accept blindly
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Error validating user:', error);
    return null;
  }

  return user;
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error getting profile:', error);
    return null;
  }

  return data;
}

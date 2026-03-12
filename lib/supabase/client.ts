import { createBrowserClient } from '@supabase/ssr';

// Using any for simplicity - replace with proper Database type for production
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://veguomydgmyinlzjabdl.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZ3VvbXlkZ215aW5semphYmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTcxOTQsImV4cCI6MjA4ODc5MzE5NH0.xVZkLTEqWYDAeFh24dEog_W8PdAcB7ydIZbOV_4cC5g'
  );
}

import { redirect } from 'next/navigation';
import { createClient, getUser, getProfile } from '@/lib/supabase/server';
import ShiftsClient from './ShiftsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ShiftsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);
  const supabase = await createClient();

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  // Fetch raw shifts without join
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .order('created_at', { ascending: false });

  // Gather unique cashier IDs
  const cashierIds = [...new Set((shifts || []).map((s: any) => s.cashier_id))];

  // Fetch profiles for those IDs
  let profiles: any[] = [];
  if (cashierIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', cashierIds);
    profiles = profileData || [];
  }

  // Map the nested cashier data to a simpler structure
  const formattedShifts = (shifts || []).map((shift: any) => {
    const cashierProfile = profiles.find((p: any) => p.id === shift.cashier_id);
    return {
      ...shift,
      cashierName: cashierProfile?.full_name || cashierProfile?.email || 'Unknown Cashier'
    };
  });

  return <ShiftsClient initialShifts={formattedShifts} />;
}

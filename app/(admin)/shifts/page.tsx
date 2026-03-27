import { redirect } from 'next/navigation';

// Shift reports feature has been removed — redirect to financial reports
export default function ShiftsPage() {
  redirect('/reports');
}

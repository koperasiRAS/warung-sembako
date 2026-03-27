import { redirect } from 'next/navigation';

// Shift feature has been removed — redirect to POS
export default function ShiftPage() {
  redirect('/pos');
}

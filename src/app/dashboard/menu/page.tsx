import { redirect } from 'next/navigation';

/** Sends old Menu Manager bookmarks to the Foody Admin instructions. */
export default function FormerMenuManagerPage() {
  redirect('/dashboard/combos');
}

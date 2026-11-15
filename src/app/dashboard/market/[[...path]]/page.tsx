import { redirect } from 'next/navigation';

/** Retires the Market interface while keeping old bookmarks usable. */
export default function FormerMarketPage() {
  redirect('/dashboard');
}

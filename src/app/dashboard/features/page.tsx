import { redirect } from 'next/navigation';

/** Sends old Feature Catalog bookmarks to restaurant-level feature management. */
export default function FormerFeatureCatalogPage() {
  redirect('/dashboard/restaurants');
}

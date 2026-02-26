import clsx from 'clsx';

// Reusable utility for combining classes
export { clsx as cn };

// Format a date string for display
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format a date for tables (shorter)
export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

// Capitalize first letter
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Plan tier badge color
export function planColor(tier: string): string {
  switch (tier) {
    case 'starter': return 'bg-blue-100 text-blue-700';
    case 'premium': return 'bg-orange-100 text-orange-700';
    case 'enterprise': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

// Role badge color
export function roleColor(role: string): string {
  switch (role) {
    case 'superadmin': return 'bg-red-100 text-red-700';
    case 'owner': return 'bg-purple-100 text-purple-700';
    case 'manager': return 'bg-blue-100 text-blue-700';
    case 'cashier': return 'bg-green-100 text-green-700';
    case 'waiter': return 'bg-yellow-100 text-yellow-700';
    case 'chef': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

// Feature category display info
export function categoryInfo(category: string): { label: string; color: string; icon: string } {
  switch (category) {
    case 'core': return { label: 'Core', color: 'text-gray-500', icon: '⚙️' };
    case 'ordering': return { label: 'Ordering', color: 'text-blue-500', icon: '🛒' };
    case 'operations': return { label: 'Operations', color: 'text-green-500', icon: '📦' };
    case 'intelligence': return { label: 'Intelligence', color: 'text-purple-500', icon: '🧠' };
    case 'notifications': return { label: 'Notifications', color: 'text-orange-500', icon: '🔔' };
    default: return { label: category, color: 'text-gray-500', icon: '•' };
  }
}

import type { FoodyLicenceCounts } from './api';

const currencyFormat = new Intl.NumberFormat('en-IL', {
  style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 2,
});

/** Display an ILS amount from the API's integer minor units. */
export function formatFoodyAmount(minor: number) {
  return currencyFormat.format(minor / 100);
}

/** Render the named licences included in a product or offer. */
export function foodyLicenceLabels(seats: FoodyLicenceCounts) {
  const labels: [number, string, string][] = [
    [seats.pos, 'named POS licence', 'named POS licences'],
    [seats.chef, 'chef access', 'chef accesses'],
    [seats.kds, 'kitchen display licence', 'kitchen display licences'],
  ];
  const result = labels.filter(([count]) => count > 0).map(([count, one, many]) => `${count} ${count === 1 ? one : many}`);
  if (seats.employees !== undefined) result.push(seats.employees === null ? 'Unlimited employee accounts' : `${seats.employees} accounts, owner included`);
  if (seats.pos_devices !== undefined) result.push(seats.pos_devices === null ? 'Unlimited physical POS devices' : `${seats.pos_devices} physical POS devices`);
  return result;
}

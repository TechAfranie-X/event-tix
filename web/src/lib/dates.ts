export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Date TBD';
  // iso should include Z from backend (UTC); this renders in the user's local zone
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function localToUtcIso(local: string): string | null {
  if (!local) return null;
  // "2025-12-13T20:00" -> make a Date in local time, then to UTC ISO
  const d = new Date(local);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    0,
    0
  ).toISOString();
}


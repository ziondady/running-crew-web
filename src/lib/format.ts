export function fmtKm(value: number | string | undefined | null): string {
  const num = Number(value);
  if (isNaN(num)) return "0";
  return (Math.round(num * 100) / 100).toFixed(2);
}

export function fmtKm(value: number | string | undefined | null): string {
  const num = Number(value);
  if (isNaN(num)) return "0";
  return (Math.round(num * 100) / 100).toFixed(2);
}

/**
 * ISO 8601 datetime 문자열을 로컬 타임존 기준 YYYY-MM-DD로 변환.
 * 백엔드가 UTC로 저장한 시각(예: 2026-04-30T15:00:00Z)을 한국 날짜(2026-05-01)로 표시할 때 사용.
 * 입력이 비어있거나 파싱 실패 시 빈 문자열 반환.
 */
/**
 * Date 객체를 로컬 타임존 기준 YYYY-MM-DD 문자열로.
 * Date.toISOString()이 UTC 기준이라 한국 시간 자정 직후 어제로 표시되는 문제 방지.
 */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtLocalDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

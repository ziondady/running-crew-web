/**
 * GPS 백업 파일 (JSONL) 관리.
 *
 * 러닝 중 수집한 GPS 포인트를 Capacitor Filesystem에 즉시 append 하여
 * 앱 크래시나 강제종료 시에도 데이터가 살아남도록 한다.
 *
 * localStorage 세션과 병행 저장하는 방어선.
 * 플랫폼 공통 (iOS/Android/web). Web 환경에서는 자동으로 no-op 처리.
 */
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

const BACKUP_FILE = "gps_backup.jsonl";
const META_FILE = "gps_backup.meta.json";

export interface BackupPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface BackupMeta {
  startedAt: number;
  sessionId: string;
}

const isNative = () => Capacitor.isNativePlatform();

/** 백업 시작. 새 세션 ID 생성, 파일 초기화. */
export async function startBackup(): Promise<BackupMeta> {
  const meta: BackupMeta = {
    startedAt: Date.now(),
    sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  };
  if (!isNative()) return meta;

  try {
    // 기존 파일 덮어쓰기
    await Filesystem.writeFile({
      path: BACKUP_FILE,
      data: "",
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    await Filesystem.writeFile({
      path: META_FILE,
      data: JSON.stringify(meta),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  } catch (e) {
    console.warn("[gpsBackup] startBackup failed", e);
  }
  return meta;
}

/** 포인트 한 개 append. 실패해도 throw 하지 않음 (메인 로직 방해 금지). */
export async function appendPoint(point: BackupPoint): Promise<void> {
  if (!isNative()) return;
  try {
    await Filesystem.appendFile({
      path: BACKUP_FILE,
      data: JSON.stringify(point) + "\n",
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  } catch (e) {
    // 무시. 백업 실패가 러닝 기록을 중단시키면 안 됨.
    console.warn("[gpsBackup] appendPoint failed", e);
  }
}

/**
 * 백업 파일 읽어서 포인트 배열로 반환.
 * 파일이 없거나 파싱 실패 시 null 반환.
 */
export async function readBackup(): Promise<{ meta: BackupMeta; points: BackupPoint[] } | null> {
  if (!isNative()) return null;
  try {
    const metaRes = await Filesystem.readFile({
      path: META_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const meta: BackupMeta = JSON.parse(metaRes.data as string);

    const fileRes = await Filesystem.readFile({
      path: BACKUP_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const content = fileRes.data as string;
    const points: BackupPoint[] = content
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as BackupPoint;
        } catch {
          return null;
        }
      })
      .filter((p): p is BackupPoint => p !== null);

    return { meta, points };
  } catch {
    return null;
  }
}

/** 백업 파일/메타 삭제. */
export async function clearBackup(): Promise<void> {
  if (!isNative()) return;
  try {
    await Filesystem.deleteFile({ path: BACKUP_FILE, directory: Directory.Data });
  } catch {}
  try {
    await Filesystem.deleteFile({ path: META_FILE, directory: Directory.Data });
  } catch {}
}

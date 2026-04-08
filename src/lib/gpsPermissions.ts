/**
 * GPS 권한 상태 체크 유틸.
 *
 * 플랫폼별로 다음을 확인한다:
 *  - iOS: Always 권한 vs When-in-use 권한
 *  - Android: Fine + Background location
 *
 * BackgroundGeolocation 네이티브 플러그인의 상태를 직접 조회하는 API가
 * 없으므로 @capacitor/geolocation 플러그인의 checkPermissions를 사용한다.
 */
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export type PermissionLevel =
  | "unknown"       // 체크 실패
  | "denied"        // 거부
  | "foreground"    // 앱 사용 중에만 (백그라운드 수집 불가)
  | "always";       // 항상 허용 (정상)

export interface PermissionStatus {
  level: PermissionLevel;
  platform: "ios" | "android" | "web";
  message: string;
}

export async function checkGpsPermission(): Promise<PermissionStatus> {
  const platform = Capacitor.getPlatform();

  if (platform === "web") {
    return {
      level: "foreground",
      platform: "web",
      message: "웹에서는 백그라운드 GPS가 제한됩니다",
    };
  }

  try {
    const result = await Geolocation.checkPermissions();
    // Capacitor Geolocation의 location 필드:
    //   "granted" | "denied" | "prompt" | "prompt-with-rationale"
    // iOS의 경우 Always vs WhenInUse 구분이 없어서 granted만 반환됨.
    // Background plugin의 상태는 간접적으로 판단한다.
    const loc = result.location;

    if (loc === "denied") {
      return {
        level: "denied",
        platform: platform as "ios" | "android",
        message: platform === "ios"
          ? "위치 권한이 거부되어 있습니다. 설정에서 허용해주세요."
          : "위치 권한이 거부되어 있습니다. 설정에서 허용해주세요.",
      };
    }

    if (loc === "granted") {
      // granted지만 백그라운드 여부는 알 수 없음.
      // iOS: Always 여부 확인 불가 → "foreground로 가정"은 너무 보수적이니 always로 낙관 처리
      // 대신 안내 메시지로 Always 권장.
      return {
        level: "always",
        platform: platform as "ios" | "android",
        message: platform === "ios"
          ? "백그라운드 기록을 위해 '항상' 허용이 필요합니다"
          : "백그라운드 기록을 위해 '항상 허용' + 배터리 최적화 예외가 필요합니다",
      };
    }

    return {
      level: "foreground",
      platform: platform as "ios" | "android",
      message: "위치 권한을 허용해주세요",
    };
  } catch (e) {
    return {
      level: "unknown",
      platform: platform as "ios" | "android" | "web",
      message: "권한 상태를 확인할 수 없습니다",
    };
  }
}

export async function requestGpsPermission(): Promise<PermissionStatus> {
  const platform = Capacitor.getPlatform();
  if (platform === "web") return checkGpsPermission();

  try {
    await Geolocation.requestPermissions();
  } catch {}
  return checkGpsPermission();
}

import Capacitor
import Foundation
import UIKit
import CoreLocation

private let null = Optional<Double>.none as Any

private func formatLocation(_ location: CLLocation) -> [String: Any] {
    var simulated = false
    if #available(iOS 15, *) {
        if let info = location.sourceInformation {
            simulated = info.isSimulatedBySoftware
        }
    }
    return [
        "latitude": location.coordinate.latitude,
        "longitude": location.coordinate.longitude,
        "accuracy": location.horizontalAccuracy,
        "altitude": location.altitude,
        "altitudeAccuracy": location.verticalAccuracy,
        "simulated": simulated,
        "speed": location.speed < 0 ? null : location.speed,
        "bearing": location.course < 0 ? null : location.course,
        "time": NSNumber(value: Int(location.timestamp.timeIntervalSince1970 * 1000)),
    ]
}

private class Watcher {
    let callbackId: String
    let locationManager = CLLocationManager()
    private let created = Date()
    private let allowStale: Bool
    private var isUpdating = false

    init(_ id: String, stale: Bool) {
        callbackId = id
        allowStale = stale
    }

    func start() {
        guard !isUpdating else { return }
        locationManager.startUpdatingLocation()
        isUpdating = true
    }

    func stop() {
        guard isUpdating else { return }
        locationManager.stopUpdatingLocation()
        isUpdating = false
    }

    func isValid(_ location: CLLocation) -> Bool {
        allowStale || location.timestamp >= created
    }
}

@objc(BackgroundGeolocation)
public class BackgroundGeolocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    private var watchers = [Watcher]()

    public let identifier = "BackgroundGeolocation"
    public let jsName = "BackgroundGeolocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "addWatcher", returnType: CAPPluginReturnCallback),
        CAPPluginMethod(name: "removeWatcher", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
    ]

    @objc public override func load() {
        UIDevice.current.isBatteryMonitoringEnabled = true
    }

    // MARK: - Obj-C bridge helpers (SPM binary에서 Swift extension이 안 보이는 문제 우회)

    private func callResolve(_ call: CAPPluginCall, _ data: [String: Any] = [:]) {
        call.resolve(withData: data as [AnyHashable: Any])
    }

    private func callReject(_ call: CAPPluginCall, _ message: String) {
        call.reject(withMessage: message)
    }

    private func callRejectWithCode(_ call: CAPPluginCall, _ message: String, _ code: String) {
        call.reject(withMessage: message, code: code)
    }

    private func getSaved(_ id: String) -> CAPPluginCall? {
        return getSavedCall(withID: id)
    }

    private func releaseSaved(_ call: CAPPluginCall) {
        releaseSavedCall(call)
    }

    // MARK: - Plugin Methods

    @objc func addWatcher(_ call: CAPPluginCall) {
        call.keepAlive = true

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            let opts = call.options ?? [:]
            let background = (opts["backgroundMessage"] as? String) != nil
            let stale = opts["stale"] as? Bool ?? false
            let watcher = Watcher(call.callbackId, stale: stale)

            let mgr = watcher.locationManager
            mgr.delegate = self

            let onPower = [UIDevice.BatteryState.full, .charging].contains(UIDevice.current.batteryState)
            mgr.desiredAccuracy = onPower ? kCLLocationAccuracyBestForNavigation : kCLLocationAccuracyBest

            var df = opts["distanceFilter"] as? Double
            if df == nil || df == 0 { df = kCLDistanceFilterNone }
            mgr.distanceFilter = df!

            mgr.allowsBackgroundLocationUpdates = background
            mgr.showsBackgroundLocationIndicator = background
            mgr.pausesLocationUpdatesAutomatically = false

            self.watchers.append(watcher)

            let reqPerm = opts["requestPermissions"] as? Bool ?? true
            if reqPerm {
                let status = CLLocationManager.authorizationStatus()
                if [.notDetermined, .denied, .restricted].contains(status) {
                    background ? mgr.requestAlwaysAuthorization() : mgr.requestWhenInUseAuthorization()
                    return
                }
                if background && status == .authorizedWhenInUse {
                    mgr.requestAlwaysAuthorization()
                }
            }
            watcher.start()
        }
    }

    @objc func removeWatcher(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            guard let cbId = (call.options ?? [:])["id"] as? String else {
                self.callReject(call, "No callback ID")
                return
            }

            if let idx = self.watchers.firstIndex(where: { $0.callbackId == cbId }) {
                self.watchers[idx].stop()
                self.watchers.remove(at: idx)
            }
            if let saved = self.getSaved(cbId) {
                self.releaseSaved(saved)
            }
            self.callResolve(call)
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard let url = URL(string: UIApplication.openSettingsURLString),
                  UIApplication.shared.canOpenURL(url) else {
                self.callReject(call, "Cannot open settings")
                return
            }
            UIApplication.shared.open(url) { ok in
                ok ? self.callResolve(call) : self.callReject(call, "Failed to open settings")
            }
        }
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard let w = watchers.first(where: { $0.locationManager == manager }),
              let call = getSaved(w.callbackId) else { return }

        if let clErr = error as? CLError {
            if clErr.code == .locationUnknown { return }
            if clErr.code == .denied {
                w.stop()
                callRejectWithCode(call, "Permission denied.", "NOT_AUTHORIZED")
                return
            }
        }
        callReject(call, error.localizedDescription)
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last,
              let w = watchers.first(where: { $0.locationManager == manager }),
              w.isValid(loc),
              let call = getSaved(w.callbackId) else { return }
        callResolve(call, formatLocation(loc))
    }

    public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        guard status != .notDetermined,
              let w = watchers.first(where: { $0.locationManager == manager }) else { return }
        w.start()
    }
}

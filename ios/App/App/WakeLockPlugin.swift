import Capacitor
import UIKit

@objc(WakeLockPlugin)
public class WakeLockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WakeLockPlugin"
    public let jsName = "WakeLock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "acquire", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise),
    ]

    @objc func acquire(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = true
            call.resolve(["acquired": true])
        }
    }

    @objc func release(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = false
            call.resolve(["released": true])
        }
    }
}

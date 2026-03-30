#import <Capacitor/Capacitor.h>

@interface CAPPluginCall (Helpers)
- (void)resolveWithData:(NSDictionary * _Nullable)data;
- (void)rejectWithMessage:(NSString * _Nonnull)message;
- (void)rejectWithMessage:(NSString * _Nonnull)message code:(NSString * _Nullable)code;
@end

@interface CAPPlugin (BridgeHelpers)
- (CAPPluginCall * _Nullable)getSavedCallWithID:(NSString * _Nonnull)callbackId;
- (void)releaseSavedCall:(CAPPluginCall * _Nonnull)call;
@end

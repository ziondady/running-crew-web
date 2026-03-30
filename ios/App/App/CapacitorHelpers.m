#import "CapacitorHelpers.h"

@implementation CAPPluginCall (Helpers)

- (void)resolveWithData:(NSDictionary *)data {
    if (data == nil) data = @{};
    CAPPluginCallResult *result = [[CAPPluginCallResult alloc] init:data];
    self.successHandler(result, self);
}

- (void)rejectWithMessage:(NSString *)message {
    CAPPluginCallError *error = [[CAPPluginCallError alloc] init:message code:nil error:nil data:nil];
    self.errorHandler(error);
}

- (void)rejectWithMessage:(NSString *)message code:(NSString *)code {
    CAPPluginCallError *error = [[CAPPluginCallError alloc] init:message code:code error:nil data:nil];
    self.errorHandler(error);
}

@end

@implementation CAPPlugin (BridgeHelpers)

- (CAPPluginCall *)getSavedCallWithID:(NSString *)callbackId {
    return [self.bridge savedCallWithID:callbackId];
}

- (void)releaseSavedCall:(CAPPluginCall *)call {
    [self.bridge releaseCall:call];
}

@end

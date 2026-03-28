import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fit.run4u.app',
  appName: '러닝크루',
  webDir: 'out',
  server: {
    url: 'https://run4u.fit',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    BackgroundGeolocation: {
      // iOS: Background Modes > Location updates 필요
    },
  },
};

export default config;

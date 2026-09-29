import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meetup.app',
  appName: 'Meet Up',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

/* eslint-disable no-console */
// Structured reconnect logger — suppressed in production builds
export const logger = {
  warn(message: string): void {
    if (import.meta.env.DEV) {
      console.warn(`[quest] ${message}`);
    }
  },
};

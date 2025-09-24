// Minimal ambient declarations so TypeScript doesn't complain.
// The Cast SDKs inject these at runtime in the browser.
declare const cast: any;
declare const chrome: any;
interface Window {
  __onGCastApiAvailable?: (isAvailable: boolean) => void;
}

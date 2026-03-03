import { useSettingsStore } from '../../stores/settingsStore.js';

export function StealthOverlay() {
  const stealth = useSettingsStore((s) => s.stealth);

  if (!stealth) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 cursor-none" />
  );
}

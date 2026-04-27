import { useState } from "react";

export function useAppOverlays() {
  const [quickOpen, setQuickOpen] = useState(false);
  const [vaultSwitcherOpen, setVaultSwitcherOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return {
    quickOpen,
    setQuickOpen,
    vaultSwitcherOpen,
    setVaultSwitcherOpen,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    settingsOpen,
    setSettingsOpen,
  };
}

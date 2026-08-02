export function resolveRestoredMute(savedMuted, isSelected) {
  return typeof savedMuted === "boolean" ? savedMuted : !isSelected;
}

// The Paseo Cafe (ticket 009, settled 2026-10-12 15:18 CDT): a free catalogue of plugins and looks for Paseo, made by
// other Paseo users. Setup offers it, default off; the tutorial's Cafe page shows only when it is in Paseo.
export const CAFE = {
  id: "paseo-cafe",
  source: "git:https://github.com/paseo-cafe/paseo-cafe.git:plugin",
  offer: "Also add the Paseo Cafe: a free catalogue of plugins and looks for Paseo, made by other Paseo users.",
};

// The Cafe updates every branch-tracking plugin every six hours, setup included, unless the plugin is on its own
// opt-out list (its settings file, version 5, read 2026-10-13). Setup changes only through the house's update offer
// (Sean, 2026-10-13: offered, never forced), so it puts itself on that list, keeping the rest of the Cafe's settings.
type CafeSettings = { version: number; values: Record<string, unknown> & { autoUpdateOptOuts?: string[] } };
export function withOptOut(current: CafeSettings | null, id: string): CafeSettings {
  const s: CafeSettings = current ?? { version: 5, values: {} };
  const outs = s.values.autoUpdateOptOuts ?? [];
  return outs.includes(id) ? s : { ...s, values: { ...s.values, autoUpdateOptOuts: [...outs, id] } };
}

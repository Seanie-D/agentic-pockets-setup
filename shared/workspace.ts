// A citizen's folder's own workspace, when Paseo has one (Friday's read of the Windows seat, 2026-10-13: Paseo makes a
// second workspace for a folder that already has one, so a second install run doubled every citizen's). Archived ones do
// not count; on Windows a folder matches in any case. No imports: plain Node tests.
type Entry = { id: string; projectId: string; projectRootPath?: string; workspaceDirectory?: string; archivingAt?: string | null };

export function workspaceFor(entries: Entry[], dir: string, windows: boolean): { workspaceId: string; projectId: string } | null {
  const norm = (p: string) => { const t = p.replace(/[\\/]+$/, ""); return windows ? t.toLowerCase() : t; };
  const w = entries.find((e) => !e.archivingAt && norm(e.workspaceDirectory ?? e.projectRootPath ?? "") === norm(dir));
  return w ? { workspaceId: w.id, projectId: w.projectId } : null;
}

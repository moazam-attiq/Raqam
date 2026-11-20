/**
 * A 409 means one of two things: someone else saved first (stale version), or the name is
 * already taken. The API gives no code to tell them apart, and matching its message text
 * would break the day a message is reworded. So fetch the record again: if its version has
 * moved on, the edit really was stale. A failed fetch counts as "not stale", leaving the
 * server's own message on screen.
 */
export async function versionHasMoved(
  fetchLatest: () => Promise<{ version: number }>,
  seenVersion: number,
): Promise<boolean> {
  try {
    return (await fetchLatest()).version !== seenVersion
  } catch {
    return false
  }
}

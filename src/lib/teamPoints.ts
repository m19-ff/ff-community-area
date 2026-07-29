/**
 * @deprecated teamPoints.ts — all logic migrated to team_wallets.
 * This file is kept as an empty shim so any forgotten import compiles.
 * All functions are no-ops.
 */

export async function syncTeamPoints(_teamId: number): Promise<void> {}

export async function adjustTeamPointsForUser(
  _userId: number,
  _delta: number,
): Promise<void> {}

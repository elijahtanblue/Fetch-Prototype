/**
 * Contribution tracking helper.
 *
 * Uses the same 30-day window as the access policy.
 */

const CONTRIBUTION_WINDOW_DAYS = 30;

export function isContributionActive(
  lastContributionAt: Date | null,
  now: Date
): boolean {
  if (!lastContributionAt) return false;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSince = Math.floor(
    (now.getTime() - lastContributionAt.getTime()) / msPerDay
  );
  return daysSince <= CONTRIBUTION_WINDOW_DAYS;
}

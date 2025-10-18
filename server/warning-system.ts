import type { IStorage } from './storage';
import type { Warning } from '@shared/schema';

export async function issueWarningForViolation(
  storage: IStorage,
  humanId: string,
  reason: string,
  messageId: string | null = null
): Promise<Warning> {
  const currentStrikeCount = await storage.getUserStrikeCount(humanId);
  
  const nextStrikeNumber = currentStrikeCount + 1;
  
  let action: 'warning' | 'timeout' | 'ban';
  let expiresAt: Date | null = null;
  
  if (nextStrikeNumber === 1) {
    action = 'warning';
  } else if (nextStrikeNumber === 2) {
    action = 'timeout';
    expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  } else {
    action = 'ban';
  }
  
  const warning = await storage.addWarning(
    humanId,
    reason,
    messageId,
    nextStrikeNumber,
    action,
    expiresAt
  );
  
  return warning;
}

import { db } from '../db';
import { auditLogs } from '@shared/schema';

export async function recordAudit(actorId: number, action: string, targetType: string, targetId?: number, metadata?: any) {
  try {
    await db.insert(auditLogs).values({
      actorId,
      action,
      targetType,
      targetId: targetId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (e) {
    // Non-fatal
    console.error('Audit log insert failed:', e);
  }
}

import { createKeyProfileRepository, type KeyActivityKind } from '../db/sqlite'

export function markKeyActivity(path: string, keyId: string, activityKind: KeyActivityKind, now = new Date().toISOString()) {
  createKeyProfileRepository(path).markKeyActivity(keyId, {
    activityAt: now,
    activityKind,
  })
}

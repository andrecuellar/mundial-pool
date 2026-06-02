// Legacy entry point — the implementation moved to src/server/notifications/.
// Kept as a re-export so older imports of `@/server/push` keep working without
// a sweeping refactor. New code should import from `@/server/notifications`.
export {
  type PushPayload,
  sendNotificationByType,
  sendPushToUser,
  sendPushToUsers,
} from './notifications/send'

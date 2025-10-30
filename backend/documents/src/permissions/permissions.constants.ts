export const DEFAULT_PERMISSIONS_SYNC_QUEUE = 'documents_permissions_sync';
export const PERMISSIONS_SYNC_QUEUE =
  process.env.DOCUMENTS_PERMISSIONS_SYNC_QUEUE_NAME ?? DEFAULT_PERMISSIONS_SYNC_QUEUE;
export const PERMISSIONS_SYNC_JOB = 'permissions.sync';

export const DEFAULT_DOCUMENTS_QUEUE = 'documents:tasks';
export const DOCUMENTS_QUEUE = process.env.DOCUMENTS_QUEUE_NAME ?? DEFAULT_DOCUMENTS_QUEUE;
export const DOCUMENTS_UPLOAD_JOB = 'documents.upload';
export const DOCUMENTS_SYNC_JOB = 'documents.sync';

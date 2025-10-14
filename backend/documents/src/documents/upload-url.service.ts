import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

import { DocumentsConfiguration } from '../config/configuration';

export interface UploadUrlPayload {
  url: string;
  expiresIn: number;
}

@Injectable()
export class UploadUrlService {
  constructor(private readonly configService: ConfigService<DocumentsConfiguration, true>) {}

  createUploadUrl(documentId: string): UploadUrlPayload {
    const baseUrl = this.configService.get('storage.uploadBaseUrl', { infer: true });
    const ttl = this.configService.get('storage.uploadTtlSeconds', { infer: true });

    const token = randomBytes(16).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;

    const url = new URL(baseUrl);
    const normalizedPath = [url.pathname.replace(/\/$/, ''), documentId].filter(Boolean).join('/');
    url.pathname = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
    url.searchParams.set('token', token);
    url.searchParams.set('expires', String(expiresAt));
    url.searchParams.set('documentId', documentId);

    return { url: url.toString(), expiresIn: ttl };
  }
}

import type { Request } from 'express';
import { getAllowedClientUrl, getPrimaryClientUrl } from '../config/env';

export function resolveClientUrl(req: Request): string {
  const candidateHeaders = [
    req.get('origin'),
    req.get('referer'),
    req.get('referrer'),
  ];

  for (const headerValue of candidateHeaders) {
    const allowedUrl = getAllowedClientUrl(headerValue);
    if (allowedUrl) return allowedUrl;
  }

  return getPrimaryClientUrl();
}


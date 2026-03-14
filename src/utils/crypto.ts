import crypto from 'crypto';

//  Razorpay Signature Verification

/**
 * Verifies a Razorpay payment signature.
 * signature = HMAC-SHA256(orderId + "|" + paymentId, keySecret)
 */
export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  keySecret: string,
): boolean {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(razorpaySignature, 'hex'),
  );
}

/**
 * Verifies a Razorpay webhook signature.
 * X-Razorpay-Signature: HMAC-SHA256(rawBody, webhookSecret)
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(signature, 'hex'),
  );
}

//  PayPal Webhook Signature Verification

/**
 * PayPal webhook signature verification.
 * Compares transmission sig using cert-based approach.
 * For production, use PayPal's verify-webhook-signature API.
 * This is a basic HMAC-based fallback.
 */
export function buildPayPalWebhookMessage(
  transmissionId: string,
  transmissionTime: string,
  webhookId: string,
  rawBody: string,
): string {
  const crc32 = computeCrc32(rawBody);
  return `${transmissionId}|${transmissionTime}|${webhookId}|${crc32}`;
}

function computeCrc32(str: string): number {
  const buf = Buffer.from(str, 'utf8');
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

//  General Crypto Helpers

export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

// ─── Cloudflare R2 (S3-compatible) client for KYC documents ─────────────────
// R2_* env vars are optional at the schema level (lib/env.ts) so the app can
// run without them configured — this module throws a clear error only when a
// KYC upload is actually attempted, matching this codebase's existing pattern
// for optional-until-used config (e.g. MPESA_*_LIVE).

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 storage is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY missing).');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2 storage is not configured (R2_BUCKET_NAME missing).');
  }
  return bucket;
}

/**
 * Uploads a KYC document for the given organization and returns the storage
 * key (not a public URL — these documents are private; use
 * getSignedDownloadUrl to grant temporary read access to the admin console).
 */
export async function uploadKycDocument(params: {
  organizationId: string;
  documentType: string;
  contentType: string;
  data: Buffer;
}): Promise<{ storageKey: string }> {
  const { organizationId, documentType, contentType, data } = params;
  const client = getClient();
  const bucket = getBucketName();
  const storageKey = `kyc/${organizationId}/${documentType}/${randomUUID()}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: data,
      ContentType: contentType,
    })
  );

  return { storageKey };
}

/**
 * Generates a short-lived signed URL for the admin console to view a
 * previously uploaded KYC document.
 */
export async function getSignedDownloadUrl(storageKey: string, expiresInSeconds = 300): Promise<string> {
  const client = getClient();
  const bucket = getBucketName();

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    { expiresIn: expiresInSeconds }
  );
}

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const tempFile = path.join(__dirname, 'sdk-types-entry.ts');
fs.writeFileSync(tempFile, `
import { z } from 'zod';
import {
  paymentInitiateRequestSchema,
  paymentInitiateDataSchema,
  paymentStatusDataSchema,
  payoutCreateRequestSchema,
  payoutCreateDataSchema,
  refundCreateRequestSchema,
  refundCreateDataSchema,
  transactionResourceSchema,
  transactionListDataSchema,
} from '../lib/schemas';

export type PaymentInitiateRequest = z.infer<typeof paymentInitiateRequestSchema>;
export type PaymentInitiateData = z.infer<typeof paymentInitiateDataSchema>;
export type PaymentStatusData = z.infer<typeof paymentStatusDataSchema>;
export type PayoutCreateRequest = z.infer<typeof payoutCreateRequestSchema>;
export type PayoutCreateData = z.infer<typeof payoutCreateDataSchema>;
export type RefundCreateRequest = z.infer<typeof refundCreateRequestSchema>;
export type RefundCreateData = z.infer<typeof refundCreateDataSchema>;
export type Transaction = z.infer<typeof transactionResourceSchema>;
export type TransactionListData = z.infer<typeof transactionListDataSchema>;
`, 'utf8');

try {
  // Use dts-bundle-generator to flatten all exported types into a single .d.ts
  execSync('npx dts-bundle-generator -o temp-sdk-types.d.ts scripts/sdk-types-entry.ts --no-check', { stdio: 'inherit' });

  const generatedTypes = fs.readFileSync('temp-sdk-types.d.ts', 'utf8');

  let output = `/* eslint-disable */
/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * 
 * This file is generated from the Zod schemas in the main application.
 * To update these types, run \`npx tsx scripts/generate-sdk-types.ts\`
 * from the root of the repository.
 */\n\n`;

  output += generatedTypes;

  // Add the C2bRegisterUrlsData which doesn't have a Zod schema but is present in openapi
  output += `\nexport type C2bRegisterUrlsData = {
  responseDescription: string;
};\n\n`;

  output += `export type SuccessResponse<T> = {
  success: true;
  data: T;
};\n\n`;

  output += `export type ErrorResponse = {
  success: false;
  error: string;
};\n\n`;

  const outputPath = path.join(__dirname, '../packages/payswift-node/src/types.ts');
  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`Successfully generated SDK types to ${outputPath}`);
} finally {
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  if (fs.existsSync('temp-sdk-types.d.ts')) fs.unlinkSync('temp-sdk-types.d.ts');
}

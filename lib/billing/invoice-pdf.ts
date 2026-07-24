import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { computeTaxBreakdown, platformKraPin } from '@/lib/billing/tax';
import type { EtimsStamp } from '@/lib/billing/etims';

// Renders the invoice PaySwift issues to a merchant as a downloadable PDF
// (Stage F), using pdf-lib — pure JS, no headless Chromium, serverless-safe.
// While PaySwift is not VAT-registered the document is an honest INTERIM
// (non-tax) invoice: VAT 0, no eTIMS/CU number, and a clear disclaimer. Once
// VAT-registered + an eTIMS stamp is supplied it becomes a compliant tax invoice
// (16% VAT block + CU number + QR) with no change to this layout.

// PaySwift's own seller identity on the invoices it issues.
const SELLER = {
  name: 'PaySwift',
  addressLines: ['Nairobi, Kenya'],
  email: 'billing@payswift.co.ke',
} as const;

const GREEN = rgb(0.07, 0.4, 0.13);
const MUTED = rgb(0.42, 0.45, 0.5);
const DARK = rgb(0.11, 0.13, 0.15);
const LINE = rgb(0.85, 0.87, 0.89);

export interface InvoicePdfData {
  invoiceNumber: string;
  issuedAt: Date;
  status: string;
  paidAt: Date | null;
  mpesaReceipt: string | null;
  /** VAT-inclusive total, whole KES. */
  amount: number;
  planName: string;
  buyerName: string;
  buyerKraPin: string | null;
  /** eTIMS control-unit stamp once VAT-registered; null for interim invoices. */
  etims: EtimsStamp | null;
}

function money(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function buildInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const tax = computeTaxBreakdown(data.amount);
  const sellerPin = platformKraPin();

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const M = 50; // margin
  let y = height - M;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}
  ) => page.drawText(s, { x, y: yy, size: opts.size ?? 10, font: opts.font ?? font, color: opts.color ?? DARK });

  const rightText = (s: string, xRight: number, yy: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    text(s, xRight - f.widthOfTextAtSize(s, size), yy, opts);
  };

  // ── Header ──
  text(SELLER.name, M, y, { size: 22, font: bold, color: GREEN });
  rightText('INVOICE', width - M, y, { size: 20, font: bold, color: DARK });
  y -= 18;
  rightText(data.invoiceNumber, width - M, y, { size: 10, color: MUTED });
  y -= 14;
  for (const line of SELLER.addressLines) {
    text(line, M, y, { size: 9, color: MUTED });
    rightText(`Issued: ${fmtDate(data.issuedAt)}`, width - M, y, { size: 9, color: MUTED });
    y -= 12;
  }
  text(SELLER.email, M, y, { size: 9, color: MUTED });
  if (sellerPin) rightText(`PIN: ${sellerPin}`, width - M, y, { size: 9, color: MUTED });
  y -= 12;
  rightText(`Status: ${data.status.toUpperCase()}`, width - M, y, { size: 9, font: bold, color: data.status === 'paid' ? GREEN : MUTED });

  // ── Bill to ──
  y -= 36;
  text('BILL TO', M, y, { size: 9, font: bold, color: MUTED });
  y -= 15;
  text(data.buyerName, M, y, { size: 12, font: bold });
  if (data.buyerKraPin) {
    y -= 13;
    text(`KRA PIN: ${data.buyerKraPin}`, M, y, { size: 9, color: MUTED });
  }

  // ── Line-item table ──
  y -= 34;
  const colDesc = M;
  const colAmt = width - M;
  drawRule(page, M, y + 14, width - M, LINE);
  text('DESCRIPTION', colDesc, y, { size: 9, font: bold, color: MUTED });
  rightText('AMOUNT', colAmt, y, { size: 9, font: bold, color: MUTED });
  y -= 8;
  drawRule(page, M, y, width - M, LINE);
  y -= 20;
  text(`PaySwift ${data.planName} plan — subscription`, colDesc, y, { size: 10 });
  rightText(money(tax.net), colAmt, y, { size: 10 });
  y -= 22;
  drawRule(page, M, y, width - M, LINE);

  // ── Totals ──
  y -= 20;
  const labelX = width - M - 200;
  text('Subtotal', labelX, y, { size: 10, color: MUTED });
  rightText(money(tax.net), colAmt, y, { size: 10 });
  y -= 16;
  if (tax.vatRegistered) {
    text(`VAT (${Math.round(tax.vatRate * 100)}%)`, labelX, y, { size: 10, color: MUTED });
    rightText(money(tax.vat), colAmt, y, { size: 10 });
  } else {
    text('VAT', labelX, y, { size: 10, color: MUTED });
    rightText('N/A', colAmt, y, { size: 10, color: MUTED });
  }
  y -= 8;
  drawRule(page, labelX, y, width - M, LINE);
  y -= 18;
  text('Total', labelX, y, { size: 12, font: bold });
  rightText(money(tax.total), colAmt, y, { size: 12, font: bold, color: GREEN });

  // ── Payment details ──
  if (data.status === 'paid') {
    y -= 34;
    text('Payment received via M-Pesa', M, y, { size: 9, font: bold, color: GREEN });
    y -= 13;
    if (data.mpesaReceipt) text(`Receipt: ${data.mpesaReceipt}`, M, y, { size: 9, color: MUTED });
    if (data.paidAt) rightText(`Paid: ${fmtDate(data.paidAt)}`, width - M, y, { size: 9, color: MUTED });
  }

  // ── eTIMS / tax-status footer ──
  y -= 44;
  if (data.etims) {
    text('KRA eTIMS', M, y, { size: 9, font: bold, color: DARK });
    y -= 13;
    text(`CU Invoice No: ${data.etims.cuInvoiceNumber}`, M, y, { size: 9, color: MUTED });
    y -= 12;
    text(`CU Signature: ${data.etims.cuReceiptSignature}`, M, y, { size: 9, color: MUTED });
    try {
      const qrPng = await QRCode.toBuffer(data.etims.qrData, { margin: 0, width: 90 });
      const img = await doc.embedPng(qrPng);
      page.drawImage(img, { x: width - M - 90, y: y - 12, width: 90, height: 90 });
    } catch {
      /* QR is best-effort; the CU number above is the authoritative reference */
    }
  } else {
    text(
      'This is not a valid tax invoice — PaySwift is not currently VAT-registered, so no VAT has',
      M,
      y,
      { size: 8, color: MUTED }
    );
    y -= 11;
    text('been charged and no KRA eTIMS control number applies.', M, y, { size: 8, color: MUTED });
  }

  // Footer
  drawRule(page, M, M + 24, width - M, LINE);
  text('Thank you for your business.', M, M + 10, { size: 8, color: MUTED });
  rightText('Generated by PaySwift', width - M, M + 10, { size: 8, color: MUTED });

  return doc.save();
}

function drawRule(page: PDFPage, x1: number, yy: number, x2: number, color: ReturnType<typeof rgb>) {
  page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.75, color });
}

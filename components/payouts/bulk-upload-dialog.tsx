'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, XCircle, CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';
import { validatePhone, validateAmount } from '@/lib/validation';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

interface ValidatedRow {
  index: number;
  phone: string;
  amount: number;
  remarks?: string;
  valid: boolean;
  errors: string[];
  outcome?: 'queued' | 'approval_pending';
}

export function BulkUploadDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setCompleted(false);

    Papa.parse<string[]>(selected, {
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: ValidatedRow[] = [];
        let data = results.data;
        if (data.length > 0 && isNaN(Number(data[0][1]))) {
          data = data.slice(1);
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rawPhone = row[0] || '';
          const rawAmount = row[1] || '';
          const remarks = row[2] || undefined;
          
          const errors: string[] = [];
          const phoneCheck = validatePhone(rawPhone);
          const amountCheck = validateAmount(rawAmount);

          if (!phoneCheck.valid) errors.push(phoneCheck.error || 'Invalid phone');
          if (!amountCheck.valid) errors.push(amountCheck.error || 'Invalid amount');

          parsed.push({
            index: i,
            phone: phoneCheck.sanitized || rawPhone,
            amount: amountCheck.sanitized || 0,
            remarks: remarks?.substring(0, 100),
            valid: errors.length === 0,
            errors,
          });
        }
        setRows(parsed);
      }
    });
  };

  const handleUpload = async () => {
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) {
      toast.error('No valid rows to process');
      return;
    }

    setUploading(true);
    try {
      const payload = validRows.map(r => ({
        phone: r.phone,
        amount: r.amount,
        remarks: r.remarks,
      }));

      const res = await fetch('/api/merchant/payouts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Bulk upload complete. ${data.data.queued} queued, ${data.data.requiresApproval} held for approval.`);
        
        // Update rows with their outcomes
        const outcomes = data.data.outcomes as Array<{ index: number; outcome: 'queued' | 'approval_pending' }>;
        const outcomeMap = new Map(outcomes.map(o => [o.index, o.outcome]));
        
        setRows(current => current.map(r => {
          if (!r.valid) return r;
          // validRows is mapped 1:1 with payload, but the backend index is based on the payload array.
          // Wait, the backend index corresponds to the filtered array!
          // We need to map the backend index back to our original row index.
          const payloadIndex = validRows.findIndex(vr => vr.index === r.index);
          const outcome = outcomeMap.get(payloadIndex);
          if (outcome) {
            return { ...r, outcome };
          }
          return r;
        }));
        
        setCompleted(true);
        router.refresh();
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('An error occurred during bulk upload');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setCompleted(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) reset(); }}>
      <DialogTrigger>
        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 gap-2">
          <Upload className="size-4" />
          Bulk Upload CSV
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Payouts</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing <span className="font-medium text-foreground">Phone, Amount, Note (optional)</span> columns.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!file ? (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg border-muted-foreground/25 bg-muted/20">
              <Upload className="size-8 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Click to browse or drag and drop</p>
              <p className="text-xs text-muted-foreground mb-4">CSV up to 500 rows</p>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Select File
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-muted-foreground">{validCount} valid, {invalidCount} invalid</p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset} disabled={uploading}>
                  {completed ? 'Start Over' : 'Clear'}
                </Button>
              </div>

              {rows.length > 0 && (
                <div className="rounded-md border max-h-[50vh] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 100).map((row, i) => (
                        <TableRow key={row.index}>
                          <TableCell>
                            {!row.valid ? (
                              <span title={row.errors.join(', ')}><XCircle className="size-4 text-destructive" /></span>
                            ) : row.outcome === 'queued' ? (
                              <Loader2 className="size-4 text-muted-foreground animate-spin" />
                            ) : row.outcome === 'approval_pending' ? (
                              <Clock className="size-4 text-[#fab219]" />
                            ) : (
                              <CheckCircle2 className="size-4 text-[#0ca30c]" />
                            )}
                          </TableCell>
                          <TableCell className={!row.valid && row.errors.some(e => e.includes('phone')) ? 'text-destructive' : ''}>
                            {row.phone || '—'}
                          </TableCell>
                          <TableCell className={!row.valid && row.errors.some(e => e.includes('amount')) ? 'text-destructive' : ''}>
                            {row.amount || '—'}
                          </TableCell>
                          <TableCell className="max-w-32 truncate text-muted-foreground">{row.remarks || '—'}</TableCell>
                          <TableCell>
                            {!row.valid ? (
                              <span className="text-xs text-destructive">{row.errors.join(', ')}</span>
                            ) : row.outcome === 'queued' ? (
                              <Badge variant="secondary">Queued for sending</Badge>
                            ) : row.outcome === 'approval_pending' ? (
                              <Badge className="bg-[#fab219] hover:bg-[#fab219]/90 text-primary-foreground">Will be sent once approved</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Ready</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {rows.length > 100 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-2">
                            ... and {rows.length - 100} more rows (preview limited to 100)
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {invalidCount > 0 && !completed && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 flex items-start gap-2">
                  <AlertCircle className="size-4 mt-0.5" />
                  <div>
                    {invalidCount} {invalidCount === 1 ? 'row has' : 'rows have'} errors and will be skipped.
                  </div>
                </div>
              )}

              {!completed && (
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleUpload} 
                    disabled={uploading || validCount === 0}
                    className="min-w-32"
                  >
                    {uploading ? (
                      <><Loader2 className="mr-2 size-4 animate-spin" /> Processing...</>
                    ) : (
                      `Submit ${validCount} valid ${validCount === 1 ? 'row' : 'rows'}`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

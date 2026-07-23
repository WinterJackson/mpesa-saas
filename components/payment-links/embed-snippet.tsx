'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { buttonSnippet, popupSnippet } from '@/lib/embed-snippets';

function SnippetBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Snippet copied to clipboard.');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — select the code and copy it manually.');
    }
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="absolute right-2 top-2"
        onClick={copy}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export function EmbedSnippet({ payUrl, scriptUrl }: { payUrl: string; scriptUrl: string }) {
  return (
    <Tabs defaultValue="button" className="w-full">
      <TabsList>
        <TabsTrigger value="button">Button</TabsTrigger>
        <TabsTrigger value="popup">Popup</TabsTrigger>
      </TabsList>

      <TabsContent value="button" className="space-y-2 pt-2">
        <p className="text-xs text-muted-foreground">
          Paste this anywhere you can add HTML (a website builder, an email, your own site). It opens
          the hosted checkout in a new tab — no code required.
        </p>
        <SnippetBlock code={buttonSnippet(payUrl)} />
      </TabsContent>

      <TabsContent value="popup" className="space-y-2 pt-2">
        <p className="text-xs text-muted-foreground">
          Same button, but the checkout opens in a popup so your page stays open behind it. Include the
          script once per page.
        </p>
        <SnippetBlock code={popupSnippet(payUrl, scriptUrl)} />
      </TabsContent>
    </Tabs>
  );
}

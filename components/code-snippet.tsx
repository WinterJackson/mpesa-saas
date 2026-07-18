"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";


export function CodeSnippet() {
  const [copied, setCopied] = useState(false);

  const codeString = `fetch('https://mpesa-saas-two.vercel.app/api/v1/payments/initiate', {
  method: 'POST',
  headers: { 'x-api-key': 'YOUR_API_KEY' },
  body: JSON.stringify({ phone: '2547XXXXXXXX', amount: 500 })
})`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-[#0d1117] w-full mx-auto transition-all duration-300 hover:shadow-floating-header hover:border-foreground/50">
      {/* Mac-style Window Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="text-xs font-mono text-zinc-400 select-none">initiate-payment.js</div>
        <button
          onClick={handleCopy}
          className="text-zinc-400 hover:text-zinc-100 transition-colors focus:outline-none"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-5 sm:p-6 text-[12px] sm:text-[14px] font-mono leading-relaxed text-zinc-300">
        <pre className="whitespace-pre-wrap break-all"><code>{`\n`}<span className="text-[#ff7b72]">const</span> <span className="text-[#79c0ff]">API_URL</span> = {`\n`}  <span className="text-[#a5d6ff]">{`'https://mpesa-saas-two.vercel.app`}</span>{`\n`}  <span className="text-[#a5d6ff]">{`/api/v1/payments/initiate'`}</span>{`\n\n`}<span className="text-[#79c0ff]">fetch</span>(<span className="text-[#79c0ff]">API_URL</span>, {'{'}{`\n`}  <span className="text-[#7ee787]">method</span>: <span className="text-[#a5d6ff]">&apos;POST&apos;</span>,{`\n`}  <span className="text-[#7ee787]">headers</span>: {'{'}{`\n`}    <span className="text-[#a5d6ff]">&apos;x-api-key&apos;</span>: <span className="text-[#a5d6ff]">&apos;YOUR_API_KEY&apos;</span>{`\n`}  {'}'},  {`\n`}  <span className="text-[#7ee787]">body</span>: <span className="text-[#ffa657]">JSON</span>.<span className="text-[#d2a8ff]">stringify</span>({'{'}{`\n`}    <span className="text-[#7ee787]">phone</span>: <span className="text-[#a5d6ff]">&apos;2547XXXXXXXX&apos;</span>,{`\n`}    <span className="text-[#7ee787]">amount</span>: <span className="text-[#79c0ff]">500</span>{`\n`}  {'}'}){`\n`}{'}'})</code></pre>
      </div>
    </div>
  );
}

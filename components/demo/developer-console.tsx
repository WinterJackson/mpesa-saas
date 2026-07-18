"use client";
import { useState, useEffect } from "react";
import { Terminal, ChevronUp, ChevronDown } from "lucide-react";

export interface ConsoleLogLine {
  id: string;
  timestamp: string;
  type: "request" | "response" | "info";
  content: string;
}

interface DeveloperConsoleProps {
  logs: ConsoleLogLine[];
  isActive: boolean;
}

export function DeveloperConsole({ logs, isActive }: DeveloperConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (logs.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    }
  }, [logs.length]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-[#0d1117] text-[#c9d1d9] shadow-2xl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2 font-mono">
          <Terminal className="size-4" />
          Developer Console
          {isActive && (
            <span className="size-1.5 rounded-full bg-status-completed animate-pulse ml-1" />
          )}
        </span>
        {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>

      {isOpen && (
        <div className="max-h-[40vh] sm:max-h-[300px] overflow-y-auto border-t border-white/10 px-4 py-3 font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-white/40">
              &gt; Waiting for a checkout to begin...
            </p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="mb-1.5">
                <span className="text-white/40">[{log.timestamp}]</span>{" "}
                <span
                  className={
                    log.type === "request"
                      ? "text-blue-400"
                      : log.type === "response"
                      ? "text-status-completed"
                      : "text-white/70"
                  }
                >
                  {log.content}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  seedValue?: string;
  seedNonce?: number;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  isStreaming,
  onStop,
  seedValue,
  seedNonce,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Allow parent (suggested prompts) to populate the input
  useEffect(() => {
    if (seedValue) {
      setValue(seedValue);
      textareaRef.current?.focus();
    }
  }, [seedNonce, seedValue]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-border bg-card/80 px-2 py-2 backdrop-blur-md sm:px-6 sm:py-4 z-10 relative">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-3xl border border-border bg-background p-2 shadow-sm transition-colors focus-within:border-brand/50 focus-within:ring-3 focus-within:ring-ring/20">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
            placeholder="Message Enactor AI…"
            aria-label="Message Enactor AI"
            className="max-h-50 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/70 mb-0.5 mr-0.5"
            >
              <Square className="size-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim() || disabled}
              aria-label="Send message"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-all mb-0.5 mr-0.5",
                value.trim() && !disabled
                  ? "bg-brand-gradient hover:opacity-90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              <ArrowUp className="size-4.5" />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[9px] sm:text-[11px] leading-tight text-muted-foreground px-2">
          Enactor AI can make mistakes. Verify the configurations through Estate
          Manager.
        </p>
      </div>
    </div>
  );
}

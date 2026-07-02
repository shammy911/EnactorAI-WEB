import { User, CheckCircle2, LoaderPinwheel, Brain, Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import type { ChatMessage } from "@/hooks/useChat";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

function formatTime(ts: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatMessageBubble({
  message,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex w-full animate-message-in items-end gap-2 mb-4 sm:gap-3 sm:mb-6",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-full shadow-sm",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "bg-brand-gradient text-white",
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="size-3 sm:size-4" />
        ) : (
          <BrandMark className="size-6 sm:size-8" />
        )}
      </div>

      <div
        className={cn(
          "flex max-w-[95%] flex-col gap-1 sm:max-w-[85%] min-w-0",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Render background events here */}
        {message.events && message.events.length > 0 && !isUser && (
          <div className="flex flex-col gap-2 mb-1.5 w-full max-w-full">
            {message.events.map((evt) => (
              <div
                key={evt.id}
                className="flex flex-col gap-1 w-fit max-w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs shadow-sm animate-in slide-in-from-top-2 fade-in duration-300"
              >
                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                  {evt.status === "thinking" && (
                    <Brain className="h-3.5 w-3.5 animate-pulse text-brand" />
                  )}
                  {evt.status === "running" && (
                    <LoaderPinwheel className="h-3.5 w-3.5 animate-spin text-brand" />
                  )}
                  {evt.status === "completed" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}

                  <span>
                    {evt.status === "thinking"
                      ? evt.type === "status"
                        ? "Thinking..."
                        : `Preparing ${evt.name}...`
                      : ""}
                    {evt.status === "running" ? `Using ${evt.name}...` : ""}
                    {evt.status === "completed" ? `Used ${evt.name}` : ""}
                  </span>
                </div>

                {/* Render the arguments nicely if they exist */}
                {evt.args && (
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground/80 break-words bg-background/50 rounded px-2 py-1">
                    {evt.args}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div
          className={cn(
            "relative group rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 text-sm leading-relaxed shadow-sm min-w-0 max-w-full",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border bg-card text-card-foreground",
          )}
        >
          {message.content && !isStreaming && (
            <button
              onClick={handleCopy}
              className={cn(
                "absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md border shadow-sm backdrop-blur-md",
                isUser 
                  ? "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20" 
                  : "bg-background/80 border-border text-muted-foreground hover:text-foreground hover:bg-background"
              )}
              title="Copy message"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          )}

          {message.content ? (
            <MarkdownRenderer
              content={message.content + (isStreaming && !isUser ? " ▍" : "")}
            />
          ) : (
            <div className="flex items-center gap-1.5 h-5 px-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 rounded-full bg-brand"
                  style={{
                    animation: "dot-bounce 1.2s infinite ease-in-out",
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <span className="px-1 text-[11px] text-muted-foreground">
          {isUser ? "You" : "Enactor AI"} · {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

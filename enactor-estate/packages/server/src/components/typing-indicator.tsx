import { BrandMark } from "@/components/brand-mark"

export function TypingIndicator() {
  return (
    <div className="flex w-full animate-message-in items-end gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-sm">
        <BrandMark className="size-4" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3.5 shadow-sm">
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
    </div>
  )
}

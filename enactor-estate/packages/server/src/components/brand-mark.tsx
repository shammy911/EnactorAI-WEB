import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Small icon using the Enactor AI logo.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative size-4", className)}>
      <Image
        src="/media/enactorAI-logo.png"
        alt="Enactor AI"
        fill
        sizes="32px"
        className="object-contain"
      />
    </div>
  );
}

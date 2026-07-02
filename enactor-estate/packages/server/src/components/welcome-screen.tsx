import Image from "next/image";
import { Server, ShieldCheck, FileText, Code2 } from "lucide-react";
import { useTheme } from "next-themes";

const SUGGESTIONS = [
  {
    icon: Server,
    title: "Check Estate Status",
    prompt: "Show me the current status of all servers in the estate.",
  },
  {
    icon: ShieldCheck,
    title: "Verify Security",
    prompt:
      "Run a quick security compliance check on the production environment.",
  },
  {
    icon: FileText,
    title: "Review Logs",
    prompt: "Summarize the recent error logs from the payment gateway.",
  },
  {
    icon: Code2,
    title: "Generate Config",
    prompt: "Generate a sample configuration for a new load balancer.",
  },
];

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
}

export function WelcomeScreen({ onSelectPrompt }: WelcomeScreenProps) {
  const { theme } = useTheme();
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
      <div className="relative mb-6 h-14 w-[210px] opacity-90">
        <Image
          src={
            theme === "light"
              ? "/media/enactorAi-light.png"
              : "/media/enactorAi-dark.png"
          }
          alt="Enactor AI"
          fill
          priority
          className="object-contain"
          sizes="210px"
        />
      </div>
      <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl mt-4">
        How can I help you <span className="text-brand-gradient">today</span>?
      </h1>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        Manage your estate, run diagnostics, or review configurations. Pick a
        starting point below or type your own request.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
          <button
            key={title}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 cursor-pointer"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand transition-colors group-hover:bg-brand-gradient group-hover:text-white">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-card-foreground">
                {title}
              </span>
              <span className="text-xs leading-snug text-muted-foreground">
                {prompt}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

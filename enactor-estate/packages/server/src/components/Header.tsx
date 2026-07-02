"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link2, LogOut, Sparkles, Trash2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

interface HeaderProps {
  onNewChat?: () => void;
}

export function Header({ onNewChat }: HeaderProps) {
  const [hasCredentials, setHasCredentials] = useState(false);
  const [estateUrl, setEstateUrl] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      setHasCredentials(!!localStorage.getItem("enactor_estate_auth"));
      setEstateUrl(localStorage.getItem("enactor_estate_url"));
    };

    checkAuth();
    window.addEventListener("credentials-updated", checkAuth);
    return () => window.removeEventListener("credentials-updated", checkAuth);
  }, []);

  const handleAuthAction = () => {
    if (hasCredentials) {
      localStorage.removeItem("enactor_estate_auth");
      localStorage.removeItem("enactor_estate_url");
      localStorage.removeItem("enactor_estate_username");
      setHasCredentials(false);
      setEstateUrl(null);
      window.dispatchEvent(new Event("credentials-updated"));
    } else {
      window.dispatchEvent(new Event("open-credentials-prompt"));
    }
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-card/80 px-2 py-3 backdrop-blur-md sm:px-6 sm:py-3 z-10 sticky top-0">
      <div className="flex items-center gap-x-0.5">
        <div className="relative h-7 w-[105px] sm:h-10 sm:w-[150px]">
          <Image
            src={
              mounted && theme === "light"
                ? "/media/enactorAi-light.png"
                : "/media/enactorAi-dark.png"
            }
            alt="Enactor AI"
            fill
            priority
            className="object-contain object-left"
            sizes="150px"
          />
        </div>
        <span className="hidden items-center gap-1.5 rounded-r-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
          Web
        </span>
      </div>

      <div className="flex items-center gap-2">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        )}
        <button
          onClick={handleAuthAction}
          className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {hasCredentials ? (
            <>
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear Credentials</span>
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Connect Estate Manager</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs">
        {/* Estate Manager URL */}
        {estateUrl && (
          <div className="hidden items-center gap-1.5 md:flex text-muted-foreground font-medium">
            <span className="text-[10px] uppercase tracking-wider opacity-60">
              Target:
            </span>
            <span
              className="max-w-[200px] truncate text-brand font-semibold"
              title={estateUrl}
            >
              {
                estateUrl.replace(
                  /^https?:\/\//,
                  "",
                ) /* Strips http:// for a cleaner look */
              }
            </span>
          </div>
        )}

        {onNewChat && (
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>
    </header>
  );
}

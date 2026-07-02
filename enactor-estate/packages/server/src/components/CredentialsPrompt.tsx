"use client";

import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import Image from "next/image";

export default function CredentialsPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [estateUrl, setEstateUrl] = useState(() => {
    // Only access localStorage if we are in the browser (not during server-side rendering)
    if (typeof window !== "undefined") {
      return localStorage.getItem("enactor_estate_url") || "";
    }
    return "";
  });
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if credentials already exist
    const auth = localStorage.getItem("enactor_estate_auth");
    if (!auth) {
      setIsOpen(true);
    }

    // Listen for custom event to open modal from the header
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-credentials-prompt", handleOpen);
    return () =>
      window.removeEventListener("open-credentials-prompt", handleOpen);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    if (!username || !password || !estateUrl) return;

    // Validate HTTP / HTTPS
    if (!estateUrl.startsWith("http://") && !estateUrl.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }

    // Sanitize URL: Strip anything after /WebMaintenance and remove trailing slashes
    let cleanUrl = estateUrl;
    const wmIndex = cleanUrl.toLowerCase().indexOf("/webmaintenance");
    if (wmIndex !== -1) {
      cleanUrl = cleanUrl.substring(0, wmIndex + "/WebMaintenance".length);
    }
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    // Create Basic Auth string: Basic base64(username:password)
    const encoded = btoa(`${username}:${password}`);
    localStorage.setItem("enactor_estate_auth", `Basic ${encoded}`);

    // Save URL
    localStorage.setItem("enactor_estate_url", cleanUrl);

    // Dispatch event so other components (like Header) know we logged in
    window.dispatchEvent(new Event("credentials-updated"));
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl relative">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex justify-center mt-2 mb-6">
          <div className="relative h-16 w-[260px] sm:h-20 sm:w-[340px] bg-zinc-950 dark:bg-transparent rounded-2xl p-3 shadow-sm dark:shadow-none transition-colors">
            <Image
              src="/media/Group 1.png"
              alt="EM to EAI Connect"
              fill
              priority
              className="object-contain drop-shadow-md dark:brightness-125 dark:contrast-125 p-2"
              sizes="340px"
            />
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-2 text-center">
          Connect to Estate Manager
        </h2>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          Enter your credentials to allow Enactor AI to manage your estate
          configurations. These are stored securely in your browser.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="text-sm font-medium text-red-500 bg-red-500/10 p-2 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Estate Manager URL
            </label>
            <input
              type="text"
              value={estateUrl}
              onChange={(e) => setEstateUrl(e.target.value)}
              placeholder="https://my-estate.enactor.co.uk/WebMaintenance"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-brand-gradient py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Save Credentials
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";

export interface BackgroundEvent {
  id: string;
  type: "tool" | "status";
  name?: string; // For tool events
  args?: string; // For tool start events
  status: "running" | "completed" | "thinking";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  events?: BackgroundEvent[]; // For assistant messages, track background events
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  //const [activeToolStatus, setActiveToolStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: input.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setIsStreaming(false);
      //setActiveToolStatus("");

      const assistantId = `assistant-${Date.now()}`;
      let fullContent = "";

      try {
        abortRef.current = new AbortController();

        // 1. Get the auth string and URL from local storage
        const emAuth = localStorage.getItem("enactor_estate_auth");
        const emUrl = localStorage.getItem("enactor_estate_url");

        // 2. Set up the headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (emAuth) {
          headers["x-em-auth"] = emAuth;
        }

        if (emUrl) {
          headers["x-em-url"] = emUrl;
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({ message: input.trim() }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          let errorMessage = `Server error: ${res.status}`;
          try {
            const errorData = await res.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (error) {
            // Fallback if the response wasn't JSON
          }
          throw new Error(errorMessage);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        setIsStreaming(true);
        setIsLoading(false);

        // Add empty assistant message that we'll update
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            timestamp: Date.now(),
            events: [], // Initialize events array for this message
          },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case "token":
                  fullContent += event.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: fullContent } : m,
                    ),
                  );
                  break;

                case "status":
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId) return m;
                      // Remove any existing "status" pill so we only show the latest thinking state
                      const filtered = (m.events || []).filter(
                        (e) => e.type !== "status",
                      );
                      if (event.content === "thinking") {
                        filtered.push({
                          id: `status-${Date.now()}`,
                          type: "status",
                          status: "thinking",
                        });
                      }
                      return { ...m, events: filtered };
                    }),
                  );
                  break;

                case "tool_generating":
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId) return m;
                      const filtered = (m.events || []).filter(
                        (e) => e.type !== "status" && e.id !== "tool-prep",
                      );
                      filtered.push({
                        id: "tool-prep",
                        type: "tool",
                        name: event.name || "Preparing tools...",
                        status: "thinking",
                      });
                      return { ...m, events: filtered };
                    }),
                  );
                  break;

                case "tool_start":
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId) return m;
                      // Remove the "Preparing tools..." pill to keep it clean
                      let newEvents = (m.events || []).filter(
                        (e) =>
                          e.name !== "Preparing tools..." &&
                          e.id !== "tool-prep",
                      );
                      // Try parsing args to a clean string format
                      let cleanArgs = event.args;
                      try {
                        const parsed = JSON.parse(event.args);
                        cleanArgs =
                          Object.keys(parsed).length > 0
                            ? JSON.stringify(parsed)
                            : "";
                      } catch {
                        /* ignore */
                      }
                      newEvents.push({
                        id: `tool-${event.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        type: "tool",
                        name: event.name,
                        status: "running",
                        args: cleanArgs,
                      });
                      return { ...m, events: newEvents };
                    }),
                  );
                  break;
                case "tool_end":
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId) return m;
                      const newEvents = [...(m.events || [])];
                      // Find the last running tool with this name
                      let toolIdx = -1;
                      for (let i = newEvents.length - 1; i >= 0; i--) {
                        if (
                          newEvents[i].type === "tool" &&
                          newEvents[i].name === event.name &&
                          newEvents[i].status === "running"
                        ) {
                          toolIdx = i;
                          break;
                        }
                      }
                      if (toolIdx >= 0) {
                        newEvents[toolIdx] = {
                          ...newEvents[toolIdx],
                          status: "completed",
                        };
                      }
                      return { ...m, events: newEvents };
                    }),
                  );
                  break;

                case "error":
                  fullContent += `\n\n[Error: ${event.content}]`;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: fullContent } : m,
                    ),
                  );
                  break;

                case "done":
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;

              // 1. Mark any running/thinking events as stopped so the spinner disappears
              const newEvents = (m.events || []).map((e) =>
                e.status === "running" || e.status === "thinking"
                  ? {
                      ...e,
                      status: "completed" as const,
                      name: e.name + " (Stopped)",
                    }
                  : e,
              );
              // 2. If the message is completely empty, add a placeholder so the 3 dots disappear
              const newContent = m.content || "*(Generation stopped)*";
              return { ...m, content: newContent, events: newEvents };
            }),
          );
          return;
        }

        const errorContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
        setMessages((prev) => {
          // If assistant message was already added, update it
          const existing = prev.find((m) => m.id === assistantId);
          if (existing) {
            return prev.map((m) =>
              m.id === assistantId ? { ...m, content: errorContent } : m,
            );
          }
          // Otherwise add a new error message
          return [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: errorContent,
              timestamp: Date.now(),
            },
          ];
        });
      } finally {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, timestamp: Date.now() } : m,
          ),
        );
        setIsLoading(false);
        setIsStreaming(false);
        //setActiveToolStatus("");
        abortRef.current = null;
      }
    },
    [isLoading],
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    // Also reset server-side conversation history for this session
    fetch("/api/chat/clear", { method: "POST" }).catch(() => {});
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    //activeToolStatus,
    sendMessage,
    clearMessages,
    stop,
  };
}

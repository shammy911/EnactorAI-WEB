"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessageBubble } from "@/components/ChatMessage";
import { Header } from "@/components/Header";
import { WelcomeScreen } from "@/components/welcome-screen";
import { TypingIndicator } from "@/components/typing-indicator";
import { useChat } from "@/hooks/useChat";
import { LoaderPinwheel } from "lucide-react";
import CredentialsPrompt from "@/components/CredentialsPrompt";

export default function Home() {
  const {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    clearMessages,
    stop,
  } = useChat();
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [promptNonce, setPromptNonce] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, isLoading, scrollToBottom]);

  const handleSelectPrompt = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    setPromptNonce((n) => n + 1);
  }, []);

  const isEmpty = messages.length === 0;

  const lastMessage = messages[messages.length - 1];
  const showTyping =
    (isStreaming || isLoading) &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      (lastMessage.role === "assistant" &&
        lastMessage.content === "" &&
        (!lastMessage.events || lastMessage.events.length === 0)));

  return (
    <>
      <CredentialsPrompt />
      <div className="mx-auto flex h-dvh w-full flex-col bg-background">
        <Header onNewChat={clearMessages} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <WelcomeScreen onSelectPrompt={handleSelectPrompt} />
          ) : (
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 px-2 py-3 sm:gap-6 sm:px-6 sm:py-6 lg:px-12">
              {messages
                .filter(
                  (m) =>
                    !(
                      m.role === "assistant" &&
                      m.content === "" &&
                      (!m.events || m.events.length === 0)
                    ),
                )
                .map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={isStreaming && message.id === lastMessage?.id}
                  />
                ))}

              {showTyping && <TypingIndicator />}

            </div>
          )}
        </div>

        <ChatInput
          onSend={sendMessage}
          isStreaming={isStreaming || isLoading}
          onStop={stop}
          seedValue={pendingPrompt}
          seedNonce={promptNonce}
          disabled={isLoading} // disable while waiting for initial response
        />
      </div>
    </>
  );
}

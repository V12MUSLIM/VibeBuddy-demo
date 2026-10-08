"use client";

import { useEffect, useRef } from "react";
import Bloub from "../Bloub";

export type ChatMessage = {
  id: number | string;
  role: "user" | "agent";
  content: string;
  attachments?: string[];
};

interface ChatMessagesProps {
  messages: ChatMessage[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  return (
    <section
      aria-label="Conversation"
      className="absolute inset-x-0 top-6 z-20 px-4 sm:top-8 "
    >
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        className="mx-auto flex max-h-[calc(100vh-12rem)] w-full max-w-3xl flex-col gap-3 overflow-y-auto scrollbar-none px-1 py-2 sm:max-h-[calc(100vh-14rem)]"
      >
        {messages.map((message) => {
          const isUser = message.role === "user";

          return (
            <article
              key={message.id}
              className={`flex w-full items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && <Bloub state="idle" size={540} color="bleu" />}
              <div
                className={
                  isUser
                    ? "max-w-[88%] rounded-[22px] rounded-br-md bg-white px-4 py-3 text-sm leading-6 text-[#111215] shadow-lg shadow-black/20 sm:max-w-[75%] sm:px-5"
                    : "max-w-[88%] rounded-[22px] rounded-bl-md border border-white/10 bg-[#111215]/75 px-4 py-3 text-sm leading-6 text-white/85 shadow-lg shadow-black/20 backdrop-blur-xl sm:max-w-[75%] sm:px-5"
                }
              >
                {message.content && (
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                )}
                {message.attachments && message.attachments.length > 0 && (
                  <ul
                    className={`flex flex-wrap gap-1.5 ${message.content ? "mt-2" : ""}`}
                  >
                    {message.attachments.map((attachment, index) => (
                      <li
                        key={`${attachment}-${index}`}
                        className={
                          isUser
                            ? "max-w-full truncate rounded-full bg-black/[0.07] px-2.5 py-1 text-xs text-black/70"
                            : "max-w-full truncate rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-white/65"
                        }
                      >
                        {attachment}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
        <div ref={endOfMessagesRef} />
      </div>
    </section>
  );
}

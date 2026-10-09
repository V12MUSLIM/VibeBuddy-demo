"use client";
import ReactMarkdown, { type Components } from "react-markdown";
import { useEffect, useRef } from "react";
import Bloub from "../bloub/Bloub";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { motion } from "motion/react";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
export type ChatMessage = {
  id: number | string;
  role: "user" | "agent";
  content: string;
  attachments?: string[];
};

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-2xl font-semibold tracking-tight first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-7">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ children, href, title }) => (
    <a
      href={href}
      title={title}
      target="_blank"
      className="underline decoration-current/40 underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-current/25 pl-4 opacity-75">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-white/15" />,
  pre: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto whitespace-pre rounded-xl border border-current/10 bg-[#090a0c] p-3">
      {children}
    </div>
  ),
  table: ({ children }) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-lg border border-current/10">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-current/10 bg-current/[0.06] px-3 py-2 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-current/[0.07] px-3 py-2 align-top last:border-b-0">
      {children}
    </td>
  ),
  code({ className, children }) {
    const match = /language-([\w+-]+)/.exec(className || "");

    if (match) {
      return (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            fontSize: "0.8rem",
          }}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }

    return (
      <code
        className={
          className
            ? "whitespace-pre font-mono text-[0.8rem]"
            : "rounded bg-current/[0.08] px-1.5 py-0.5 font-mono text-[0.85em]"
        }
      >
        {children}
      </code>
    );
  },
};

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string;
}

export default function ChatMessages({
  messages,
  isStreaming,
  streamingMessageId,
}: ChatMessagesProps) {
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
        className="mx-auto flex max-h-[calc(100vh-12rem)] w-full max-w-4xl flex-col  gap-6 overflow-y-auto scrollbar-none px-1 py-2 sm:max-h-[calc(100vh-14rem)]"
      >
        {messages.map((message) => {
          const isUser = message.role === "user";

          return (
            <article
              key={message.id}
              className={`flex w-full items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <Bloub
                  state={
                    isStreaming && streamingMessageId === message.id
                      ? "orbit"
                      : "idle"
                  }
                  size={50}
                  color="bleu"
                />
              )}
              <div
                className={
                  isUser
                    ? "max-w-[88%] rounded-[22px] rounded-br-md bg-white px-4 py-3 text-sm leading-6 text-[#111215] shadow-lg shadow-black/20 sm:max-w-[75%] sm:px-5"
                    : "max-w-[88%] rounded-[22px] rounded-bl-md border border-white/10 bg-[#111215]/75 px-4 py-3 text-sm leading-6 text-white/85 shadow-lg shadow-black/20 backdrop-blur-xl sm:max-w-[75%] sm:px-5"
                }
              >
                {message.content && (
                  <motion.div className="wrap-break-word">
                    <ReactMarkdown
                      components={markdownComponents}
                      remarkPlugins={[remarkGfm]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </motion.div>
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

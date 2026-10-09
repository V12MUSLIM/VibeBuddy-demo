import { type ChatMessage } from "@/components/UI/ChatMessages";
import { useState } from "react";

export default function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIstreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState("");
  async function sendMessage(message: string, files: File[]) {
     const tempId = crypto.randomUUID()
    setStreamingMessageId(tempId);
   
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content: message,
      role: "user",
      attachments: files.map((file) => file.name),
    };
    setMessages((prev) => [...prev, userMessage]);

    setMessages((prev) => [
      ...prev,
      {
        id: tempId ,
        content: "",
        role: "agent",
      },
    ]);
    const conversation = [...messages, userMessage];

    try {
      setIstreaming(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.map(({ role, content, attachments }) => ({
            role,
            content,
            ...(attachments && { attachments }),
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "The request failed.");
      }
      if (!response.body) {
        throw new Error("This response has no stream.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();

          if (done) break;

          const text = decoder.decode(value, { stream: true });

          if (text) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempId 
                  ? { ...msg, content: msg.content + text }
                  : msg,
              ),
            );
          }
        }
        const lastText = decoder.decode();
        if (lastText) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempId 
                ? { ...msg, content: msg.content + lastText }
                : msg,
            ),
          );
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      console.error("Error", err);
    } finally {
      setIstreaming(false);
    }
  }
  return { messages, sendMessage, isStreaming /*error */, streamingMessageId };
}

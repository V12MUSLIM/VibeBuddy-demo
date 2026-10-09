"use client";
import Bloub from "@/components/bloub/Bloub";
import Composer from "@/components/UI/Composer";
import ChatMessages from "@/components/UI/ChatMessages";
import LightRays from "@/components/LightRays";
import { motion } from "motion/react";
import { useState } from "react";
import useChat from "@/hooks/useChat";
export default function Home() {
  const [isFocused, setIsFocused] = useState(false);
  const [mode, setMode] = useState<"idle" | "work">("idle");

  const { messages, sendMessage, isStreaming, streamingMessageId } = useChat();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090a0c] text-white">
      {mode == "idle" && (
        <>
          <div className="absolute inset-0 z-0" aria-hidden="true">
            <LightRays
              raysOrigin="top-center"
              raysColor="#ffffff"
              raysSpeed={1}
              lightSpread={0.5}
              rayLength={1000}
              followMouse
              mouseInfluence={0}
              noiseAmount={0}
              distortion={0}
              className="custom-rays"
              pulsating={false}
              fadeDistance={1}
              saturation={1}
            />
          </div>

          <motion.div
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <header className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-10 text-center sm:pt-14">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.32em] text-white/45 sm:text-xs">
                VibeBuddy
              </p>
              <h1 className="text-3xl font-medium tracking-[-0.045em] text-white sm:text-5xl">
                What&apos;s on your mind?
              </h1>
              <p className="mt-3 text-sm text-white/50 sm:text-base">
                A little space to think, with a buddy by your side.
              </p>
            </header>

            <div className="relative z-10 flex min-h-screen items-center justify-center pb-32 sm:pb-24">
              <Bloub
                state="idle"
                expression={isFocused ? "attentif" : "neutre"}
                size={540}
              />
            </div>
          </motion.div>
        </>
      )}
      {mode === "work" && (
        <ChatMessages
          streamingMessageId={streamingMessageId}
          isStreaming={isStreaming}
          messages={messages}
        />
      )}
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <Composer
          setMode={setMode}
          setIsFocused={setIsFocused}
          onSend={sendMessage}
        />
      </motion.div>
    </main>
  );
}

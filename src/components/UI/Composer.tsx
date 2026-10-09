"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";

const MAX_TEXTAREA_HEIGHT = 180;
type ComposerProps = {
  setIsFocused: Dispatch<SetStateAction<boolean>>;
  setMode: Dispatch<SetStateAction<"work"| "idle">>;
  onSend: (message: string, files: File[]) => void;
};
export default function Composer({ setIsFocused, setMode, onSend }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [draft]);

  function addFiles(incoming: FileList | File[]) {
    setFiles((current) => {
      const next = [...current];
      for (const file of Array.from(incoming)) {
        const alreadyAdded = next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified,
        );
        if (!alreadyAdded) next.push(file);
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message && files.length === 0) return;

    onSend(message, files);
    setDraft("");
    setFiles([]);
    setMode("work");
  }

  function handleDrop(event: ReactDragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  }

  return (
    <div className="pointer-events-none  absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-4 pb-5 sm:pb-8">
      <form
        onSubmit={handleSubmit}
        onDragEnter={(event) => {
          if (event.dataTransfer.types.includes("Files"))
            setIsDraggingFiles(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setIsDraggingFiles(false);
          }
        }}
        onDrop={handleDrop}
        className={`pointer-events-auto relative w-full max-w-2xl rounded-[26px] border bg-[#111215]/85 p-3 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl transition-colors ${isDraggingFiles ? "border-white/50" : "border-white/[0.12] focus-within:border-white/20"}`}
      >
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[20px] border border-dashed border-white/40 bg-[#111215]/95 text-sm text-white/80 backdrop-blur-xl">
            Drop files to attach
          </div>
        )}

        <label htmlFor="message" className="sr-only">
          Message VibeBuddy
        </label>
        <textarea
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          ref={textareaRef}
          id="message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.currentTarget.blur();
              return;
            }
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Message VibeBuddy…"
          rows={1}
          className="composer-textarea min-h-12 w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 text-white outline-none placeholder:text-white/40"
        />

        {files.length > 0 && (
          <ul
            className="flex flex-wrap gap-2 px-2 pb-2"
            aria-label="Attached files"
          >
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-1 pl-3 pr-1 text-xs text-white/70"
              >
                <span className="max-w-52 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((item) => item !== file),
                    )
                  }
                  aria-label={`Remove ${file.name}`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="m7 7 10 10M17 7 7 17"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              className="flex size-9 items-center justify-center rounded-full border border-white/10 text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.currentTarget.files)
                  addFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <span className="hidden text-xs text-white/35 sm:inline">
              Enter to send · Shift + Enter for a new line · Esc to unfocus
            </span>
          </div>
          <button
            type="submit"
            disabled={!draft.trim() && files.length === 0}
            aria-label="Send message"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#111215] transition-all hover:scale-[1.04] hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/35 disabled:hover:scale-100"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 19V5m0 0 6 6m-6-6-6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import React from "react";
import { ArrowUp, Square, Sparkles, Paperclip, X, FileText, Image as ImageIcon, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface ChatAttachment {
  id: string;
  name: string;
  mediaType: string; // e.g. "image/png", "application/pdf"
  sizeBytes: number;
  data: string; // base64 data URL
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;
}

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif,application/pdf";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = "Nachricht schreiben...",
  suggestions,
  onSuggestionClick,
  className,
  attachments,
  onAttachmentsChange,
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const attachmentsEnabled = Boolean(onAttachmentsChange);
  const currentAttachments = attachments ?? [];

  React.useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || currentAttachments.length > 0) && !isStreaming) onSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onAttachmentsChange) return;
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    handleFiles(dt.files);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !onAttachmentsChange) return;
    setUploadError(null);
    const newAttachments: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name} ist größer als 20MB`);
        continue;
      }
      try {
        const data = await fileToDataUrl(file);
        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mediaType: file.type,
          sizeBytes: file.size,
          data,
        });
      } catch {
        setUploadError(`Konnte ${file.name} nicht lesen`);
      }
    }
    if (newAttachments.length > 0) {
      onAttachmentsChange([...currentAttachments, ...newAttachments]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange?.(currentAttachments.filter((a) => a.id !== id));
  };

  const hasContent = value.trim().length > 0 || currentAttachments.length > 0;

  return (
    <div className={className}>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {suggestions.map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => onSuggestionClick?.(s)}
              className="rounded-2xl border border-ocean/[0.08] bg-white px-4 py-2.5 text-xs text-ocean/55 hover:text-ocean hover:border-ocean/[0.15] hover:shadow-sm transition-all duration-200 active:scale-[0.97]"
            >
              {s}
            </motion.button>
          ))}
        </div>
      )}

      <motion.div
        className={`
          relative rounded-3xl border bg-white p-2
          shadow-[0_2px_20px_rgba(32,35,69,0.06)]
          transition-all duration-300
          ${isFocused ? "border-blush/60 shadow-[0_4px_30px_rgba(242,200,210,0.15)]" : "border-ocean/[0.08]"}
          ${isStreaming ? "border-ivory/40" : ""}
        `}
        layout
      >
        {/* Attachments preview */}
        {currentAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pt-2 pb-1">
            {currentAttachments.map((a) => {
              const isImage = a.mediaType.startsWith("image/");
              const sizeKb = Math.round(a.sizeBytes / 1024);
              return (
                <div
                  key={a.id}
                  className="group flex items-center gap-2 rounded-xl bg-ocean/[0.04] border border-ocean/[0.08] pl-2 pr-1 py-1.5 max-w-[240px]"
                >
                  {isImage ? (
                    <ImageIcon className="h-3.5 w-3.5 text-ocean/50 shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-blush-dark shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-ocean truncate">{a.name}</p>
                    <p className="text-[10px] text-ocean/40">{sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`}</p>
                  </div>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    className="h-5 w-5 flex items-center justify-center rounded-md hover:bg-ocean/[0.08] text-ocean/40 hover:text-ocean transition-colors"
                    title="Entfernen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {uploadError && (
          <div className="mx-2 mt-2 mb-1 flex items-center gap-1.5 text-[11px] text-red-500">
            <AlertCircle className="h-3 w-3" />
            <span>{uploadError}</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled || isStreaming}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none disabled:opacity-50"
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-1 pl-1">
            {attachmentsEnabled && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isStreaming}
                  title="Datei anhängen (Bild oder PDF, max 20MB)"
                  className="h-8 w-8 flex items-center justify-center rounded-full text-ocean/40 hover:text-ocean hover:bg-ocean/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </>
            )}
            <div className="flex items-center gap-2 pl-1">
              <Sparkles className="h-3.5 w-3.5 text-ocean/20" />
              <span className="text-[11px] text-ocean/25 font-medium">Content Agent</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isStreaming ? (
              <motion.button
                key="stop"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ivory/10 hover:bg-ivory/20 transition-colors"
              >
                <Square className="h-3.5 w-3.5 text-ivory fill-ivory" />
              </motion.button>
            ) : (
              <motion.button
                key="send"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={onSubmit}
                disabled={!hasContent}
                className={`
                  flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200
                  ${hasContent
                    ? "bg-ocean hover:bg-ocean-light text-white shadow-sm hover:shadow-md hover:shadow-ocean/15 active:scale-95"
                    : "bg-ocean/[0.06] text-ocean/25 cursor-not-allowed"
                  }
                `}
              >
                <ArrowUp className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

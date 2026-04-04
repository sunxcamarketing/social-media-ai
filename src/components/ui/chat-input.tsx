"use client";

import React from "react";
import { ArrowUp, Square, Sparkles, Paperclip, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
}

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
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  // Auto-resize textarea
  React.useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isStreaming) onSubmit();
    }
  };

  const hasContent = value.trim().length > 0;

  return (
    <div className={className}>
      {/* Suggestions - show above input when no messages */}
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

      {/* Input box */}
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
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled || isStreaming}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none disabled:opacity-50"
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-1 pt-1">
          {/* Left side - branding */}
          <div className="flex items-center gap-2 pl-2">
            <Sparkles className="h-3.5 w-3.5 text-ocean/20" />
            <span className="text-[11px] text-ocean/25 font-medium">Content Agent</span>
          </div>

          {/* Right side - send/stop */}
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

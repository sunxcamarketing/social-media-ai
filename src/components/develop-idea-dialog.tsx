"use client";

import { Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentAgentChat } from "@/components/content-agent-chat";

interface DevelopIdeaDialogProps {
  /** Whether the dialog is open. Closes on outside click + ESC via onOpenChange(false). */
  open: boolean;
  /** Fired when the dialog should close (user clicked away or pressed ESC). */
  onClose: () => void;
  /** Client scope for the chat session. */
  clientId: string;
  /** Title shown in the dialog header. */
  title: string;
  /** Optional short summary shown under the title (2-line clamp). */
  subtitle?: string;
  /** Seed message auto-sent to the Content Agent on mount. */
  seedMessage: string;
  /** Stable key so the chat remounts per idea (new session, fresh state). */
  dialogKey: string;
  /** Optional callback fired when the agent saves a script via save_script. */
  onScriptSaved?: () => void | Promise<void>;
}

/**
 * Shared dialog that opens the Content Agent chat pre-seeded with an
 * idea/brief so the user can iterate it into a full script. Used by:
 * - Scripts page (develop a generated week-idea)
 * - Ideas tab (develop a saved idea)
 * Keeps the idea-shape abstraction at the caller; this dialog just renders
 * title + subtitle + chat.
 */
export function DevelopIdeaDialog({
  open,
  onClose,
  clientId,
  title,
  subtitle,
  seedMessage,
  dialogKey,
  onScriptSaved,
}: DevelopIdeaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 glass-strong rounded-2xl border-ocean/[0.06] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-ocean/[0.06] shrink-0">
          <DialogTitle className="flex items-start gap-2 text-left">
            <Lightbulb className="h-4 w-4 text-blush-dark mt-1 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug break-words">{title}</p>
              {subtitle && (
                <p className="text-xs text-ocean/60 leading-relaxed mt-1 font-normal line-clamp-2 break-words">
                  {subtitle}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {open && (
            <ContentAgentChat
              key={dialogKey}
              clientId={clientId}
              layout="embedded"
              title="Content Agent"
              initialUserMessage={seedMessage}
              onScriptSaved={onScriptSaved}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

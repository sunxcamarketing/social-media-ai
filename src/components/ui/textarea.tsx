import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // `field-sizing: content` was the shadcn default but it makes the
        // textarea collapse / expand with its current content. Inside any
        // grid / flex layout that means the surrounding column resizes
        // every keystroke — most painfully visible on the script edit
        // dialog where the whole modal jumped narrower as you typed.
        // Default back to `fixed` so width comes from the layout, not the
        // content. Callers that want auto-sizing can opt in via className.
        "flex field-sizing-fixed min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

import * as React from "react"

import { cn } from "@/lib/utils"

let availabilityRequest: Promise<boolean> | undefined
function gptZeroAvailable(): Promise<boolean> {
  availabilityRequest ??= fetch("/api/gptzero/status")
    .then(response => response.ok ? response.json() : { available: false })
    .then(data => data.available === true)
    .catch(() => false)
  return availabilityRequest
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, value, defaultValue, onChange, ...props }, ref) => {
  const [uncontrolledText, setUncontrolledText] = React.useState(String(defaultValue ?? ""))
  const [detection, setDetection] = React.useState("GPTZero: waiting for text")
  const text = String(value ?? uncontrolledText)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  React.useEffect(() => {
    if (!text.trim()) {
      setDetection("GPTZero: waiting for text")
      return
    }
    if (text.trim().length < 250) {
      setDetection("GPTZero: needs at least 250 characters")
      return
    }
    if (text.length > 100_000) {
      setDetection("GPTZero: text exceeds the 100,000-character detection limit")
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setDetection("GPTZero: checking availability…")
    const timer = window.setTimeout(async () => {
      try {
        if (!await gptZeroAvailable()) {
          if (!cancelled) setDetection("GPTZero: unavailable (not configured)")
          return
        }
        if (cancelled) return
        setDetection("GPTZero: analyzing…")
        const response = await fetch("/api/gptzero/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || "Detection failed")
        if (!cancelled) setDetection(`GPTZero: ${result.aiScore}% estimated AI probability`)
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          setDetection(`GPTZero: ${error instanceof Error ? error.message : "detection failed"}`)
        }
      }
    }, 1800)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [text])

  return (
    <div className="w-full">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-live="polite">
        <span>{wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}</span>
        <span>{detection}</span>
      </div>
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onChange={event => {
          setUncontrolledText(event.target.value)
          onChange?.(event)
        }}
        {...props}
      />
    </div>
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

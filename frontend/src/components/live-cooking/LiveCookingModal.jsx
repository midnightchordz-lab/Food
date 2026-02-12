import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

/**
 * LiveCookingModal
 *
 * STRICT RULES FOLLOWED:
 * - Purely presentational UI layer
 * - Receives ALL state + handlers via props
 * - Does NOT create cooking logic
 * - Does NOT modify global state
 * - Safe full-screen modal only
 */

export default function LiveCookingModal({
  open,
  onClose,
  recipeImage,
  currentStepText,
  helperText,
  isPlaying,
  onPrev,
  onNext,
  onTogglePlay,
  timerLabel,
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="fixed inset-0 h-screen w-screen max-w-none border-0 bg-black p-0">
        {/* Background visual */}
        <div className="absolute inset-0 overflow-hidden">
          {recipeImage && (
            <img
              src={recipeImage}
              alt="Recipe background"
              className="h-full w-full object-cover blur-2xl scale-110 opacity-40"
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />
        </div>

        {/* Main layout */}
        <div className="relative z-10 flex h-full w-full flex-col text-white">
          {/* Top bar */}
          <div className="flex items-center justify-between p-4 md:p-6">
            <div className="text-sm opacity-70">Live Cooking</div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/10"
              data-testid="live-cooking-close-btn"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Center step content */}
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div className="max-w-2xl space-y-4">
              <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
                {currentStepText || "Preparing your next step..."}
              </h1>

              {helperText && (
                <p className="text-base opacity-70 md:text-lg">{helperText}</p>
              )}
            </div>
          </div>

          {/* Bottom controls */}
          <div className="pb-safe flex flex-col items-center gap-4 p-6">
            {/* Timer */}
            {timerLabel && (
              <div className="text-sm opacity-70">{timerLabel}</div>
            )}

            {/* Control buttons */}
            <div className="flex items-center gap-6">
              <Button
                variant="secondary"
                size="icon"
                onClick={onPrev}
                className="h-12 w-12 rounded-full"
                data-testid="live-cooking-prev-btn"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              <Button
                variant="default"
                size="icon"
                onClick={onTogglePlay}
                className="h-16 w-16 rounded-full text-black"
                data-testid="live-cooking-play-btn"
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7" />
                ) : (
                  <Play className="h-7 w-7" />
                )}
              </Button>

              <Button
                variant="secondary"
                size="icon"
                onClick={onNext}
                className="h-12 w-12 rounded-full"
                data-testid="live-cooking-next-btn"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>

            {/* Exit hint */}
            <button
              onClick={onClose}
              className="text-xs opacity-60 hover:opacity-100"
              data-testid="live-cooking-exit-btn"
            >
              Exit Live Cooking
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

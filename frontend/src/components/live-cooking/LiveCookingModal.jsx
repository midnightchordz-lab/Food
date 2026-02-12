import React from "react";
import { Dialog, DialogContent, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveCooking } from "@/stores/useLiveCooking";

/**
 * LiveCookingModal - Premium Cinematic Design
 * Root-mounted for true fullscreen experience
 * Uses Zustand store for global state management
 */

export default function LiveCookingModal() {
  const { 
    open, 
    closeModal, 
    recipeImage, 
    instructions, 
    currentStep, 
    isPlaying,
    nextStep,
    prevStep,
    togglePlay
  } = useLiveCooking();

  // Get current step text
  const currentStepText = instructions[currentStep]?.text || 
                          instructions[currentStep]?.instruction || 
                          instructions[currentStep] || 
                          "Preparing your next step...";
  
  const helperText = instructions.length > 0 
    ? `Step ${currentStep + 1} of ${instructions.length}` 
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeModal()}>
      <DialogPortal>
        <DialogContent 
          className="fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none border-0 p-0 m-0"
        >
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="relative h-full w-full"
            >
              {/* Cinematic Background */}
              <div className="absolute inset-0">
                {/* Animated background image */}
                {recipeImage && (
                  <motion.img
                    src={recipeImage}
                    alt="Recipe"
                    className="h-full w-full object-cover"
                    initial={{ scale: 1.1, filter: "blur(20px)" }}
                    animate={{ 
                      scale: 1.15, 
                      filter: "blur(30px)",
                    }}
                    transition={{ 
                      duration: 20, 
                      repeat: Infinity, 
                      repeatType: "reverse",
                      ease: "linear" 
                    }}
                    style={{ opacity: 0.4 }}
                  />
                )}
                
                {/* Premium gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/90" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
                
                {/* Ambient glow effect */}
                <motion.div
                  className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>

              {/* Main Content */}
              <div className="relative z-10 flex h-full w-full flex-col">
                
                {/* Top Bar */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="flex items-center justify-between p-4 md:p-6"
                >
                  {/* Live indicator */}
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10"
                      animate={{ opacity: [1, 0.7, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full bg-red-500"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <span className="text-xs font-medium text-white/90 uppercase tracking-wider">
                        Live Cooking
                      </span>
                    </motion.div>
                  </div>

                  {/* Close button */}
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={closeModal}
                      className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:text-white"
                      data-testid="live-cooking-close-btn"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </motion.div>
                </motion.div>

                {/* Center Content - Step Display */}
                <div className="flex flex-1 items-center justify-center px-6 md:px-12">
                  <motion.div
                    key={currentStepText}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -30, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="max-w-4xl text-center"
                  >
                    {/* Step indicator pill */}
                    {helperText && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 mb-6"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-sm font-medium text-white/80">
                          {helperText}
                        </span>
                      </motion.div>
                    )}

                    {/* Main step text */}
                    <motion.h1
                      className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight text-white"
                      style={{
                        textShadow: "0 4px 30px rgba(0,0,0,0.5)",
                      }}
                    >
                      {currentStepText}
                    </motion.h1>
                  </motion.div>
                </div>

                {/* Bottom Controls */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="pb-safe flex flex-col items-center gap-6 p-6 md:p-8"
                >
                  {/* Progress bar */}
                  <div className="w-full max-w-md">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: isPlaying ? "100%" : "0%" }}
                        transition={{ 
                          duration: isPlaying ? 30 : 0.3, 
                          ease: "linear" 
                        }}
                      />
                    </div>
                  </div>

                  {/* Control buttons */}
                  <div className="flex items-center gap-4 md:gap-6">
                    {/* Previous */}
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={prevStep}
                        className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:text-white"
                        data-testid="live-cooking-prev-btn"
                      >
                        <ChevronLeft className="h-7 w-7" />
                      </Button>
                    </motion.div>

                    {/* Play/Pause - Main button */}
                    <motion.div 
                      whileHover={{ scale: 1.05 }} 
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={togglePlay}
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white shadow-2xl shadow-violet-500/30 border-0"
                        data-testid="live-cooking-play-btn"
                      >
                        <motion.div
                          key={isPlaying ? "pause" : "play"}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          {isPlaying ? (
                            <Pause className="h-8 w-8 md:h-10 md:w-10" />
                          ) : (
                            <Play className="h-8 w-8 md:h-10 md:w-10 ml-1" />
                          )}
                        </motion.div>
                      </Button>
                    </motion.div>

                    {/* Next */}
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={nextStep}
                        className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:text-white"
                        data-testid="live-cooking-next-btn"
                      >
                        <ChevronRight className="h-7 w-7" />
                      </Button>
                    </motion.div>
                  </div>

                  {/* Exit hint */}
                  <motion.button
                    onClick={closeModal}
                    className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                    whileHover={{ y: -2 }}
                    data-testid="live-cooking-exit-btn"
                  >
                    <span>Press ESC or tap to exit</span>
                  </motion.button>
                </motion.div>
              </div>

              {/* Decorative elements */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-transparent pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-fuchsia-500/10 to-transparent pointer-events-none" />
            </motion.div>
          )}
        </AnimatePresence>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

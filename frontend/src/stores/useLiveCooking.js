import { create } from "zustand";

export const useLiveCooking = create((set) => ({
  open: false,
  recipeImage: null,
  instructions: [],
  currentStep: 0,
  isPlaying: false,
  
  openModal: (recipeImage, instructions) => set({ 
    open: true, 
    recipeImage,
    instructions: instructions || [],
    currentStep: 0,
    isPlaying: false
  }),
  closeModal: () => set({ open: false }),
  
  nextStep: () => set((state) => ({ 
    currentStep: Math.min(state.instructions.length - 1, state.currentStep + 1) 
  })),
  prevStep: () => set((state) => ({ 
    currentStep: Math.max(0, state.currentStep - 1) 
  })),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
}));

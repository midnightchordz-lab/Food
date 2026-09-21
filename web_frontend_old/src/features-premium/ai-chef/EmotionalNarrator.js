/**
 * Emotional Narrator - Handles TTS with emotional voices
 * Uses ElevenLabs API for premium voice, falls back to Web Speech API
 * 100% isolated - no dependencies on existing code
 */

import axios from 'axios';
import platformDetector from './PlatformDetector';

class EmotionalNarrator {
  constructor() {
    this.apiKey = process.env.REACT_APP_ELEVENLABS_API_KEY;
    this.voiceId = process.env.REACT_APP_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    this.isSpeaking = false;
    this.currentAudio = null;
    this.onSpeakingChange = null;
    
    // Web Speech fallback
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.selectedVoice = null;
    
    this.loadVoices();
  }

  loadVoices() {
    if (!this.synth) return;
    
    const setVoice = () => {
      const voices = this.synth.getVoices();
      this.selectedVoice = voices.find(v => 
        v.name.includes('Google') || v.name.includes('Samantha')
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    };
    
    setVoice();
    this.synth.onvoiceschanged = setVoice;
  }

  async speak(text, emotion = 'neutral') {
    if (this.isSpeaking) {
      this.stop();
      await new Promise(r => setTimeout(r, 100));
    }

    this.isSpeaking = true;
    this.onSpeakingChange?.(true);

    // Try ElevenLabs first, fall back to Web Speech
    if (this.apiKey) {
      try {
        await this.speakWithElevenLabs(text, emotion);
        return;
      } catch (error) {
        console.log('[Narrator] ElevenLabs failed, using fallback:', error.message);
      }
    }

    // Fallback to Web Speech API
    await this.speakWithWebSpeech(text);
  }

  async speakWithElevenLabs(text, emotion) {
    const stability = this.getEmotionSettings(emotion);
    
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
      {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: stability.stability,
          similarity_boost: stability.similarity,
          style: stability.style,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        responseType: 'arraybuffer'
      }
    );

    const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    return new Promise((resolve, reject) => {
      this.currentAudio = new Audio(audioUrl);
      
      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.isSpeaking = false;
        this.onSpeakingChange?.(false);
        this.currentAudio = null;
        resolve();
      };

      this.currentAudio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl);
        this.isSpeaking = false;
        this.onSpeakingChange?.(false);
        this.currentAudio = null;
        reject(new Error('Audio playback failed'));
      };

      this.currentAudio.play().catch(reject);
    });
  }

  getEmotionSettings(emotion) {
    const settings = {
      encouraging: { stability: 0.5, similarity: 0.8, style: 0.7 },
      celebratory: { stability: 0.4, similarity: 0.9, style: 0.9 },
      cautioning: { stability: 0.7, similarity: 0.7, style: 0.3 },
      informative: { stability: 0.8, similarity: 0.75, style: 0.4 },
      supportive: { stability: 0.6, similarity: 0.8, style: 0.5 },
      patient: { stability: 0.7, similarity: 0.75, style: 0.4 },
      helpful: { stability: 0.65, similarity: 0.8, style: 0.5 },
      neutral: { stability: 0.75, similarity: 0.75, style: 0.5 }
    };
    
    return settings[emotion] || settings.neutral;
  }

  async speakWithWebSpeech(text) {
    if (!this.synth) {
      this.isSpeaking = false;
      this.onSpeakingChange?.(false);
      return;
    }

    return new Promise((resolve) => {
      this.synth.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        this.onSpeakingChange?.(false);
        resolve();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.onSpeakingChange?.(false);
        resolve();
      };

      this.synth.speak(utterance);

      // Safari kick
      setTimeout(() => {
        if (!this.synth.speaking) {
          try { this.synth.resume(); } catch {}
        }
      }, 250);
    });
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    if (this.synth) {
      this.synth.cancel();
    }
    
    this.isSpeaking = false;
    this.onSpeakingChange?.(false);
  }

  setOnSpeakingChange(callback) {
    this.onSpeakingChange = callback;
  }

  getIsSpeaking() {
    return this.isSpeaking;
  }
}

export const emotionalNarrator = new EmotionalNarrator();
export default emotionalNarrator;

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VoiceControls = ({ onTranscription, autoPlayResponse = true, language = 'en' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [detectedMood, setDetectedMood] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const lastResponseRef = useRef(null);

  useEffect(() => {
    // Create audio element
    audioRef.current = new Audio();
    audioRef.current.onended = () => setIsPlaying(false);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.success('Recording started... Speak now!');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', currentLanguage);
      
      const response = await axios.post(`${API}/voice/transcribe`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        params: {
          language: currentLanguage
        }
      });
      
      const { text, detected_mood } = response.data;
      
      if (detected_mood) {
        setDetectedMood(detected_mood);
        toast.success(`Mood detected: ${detected_mood}`);
      }
      
      // Send transcribed text to parent
      if (onTranscription) {
        onTranscription(text, detected_mood);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error('Failed to transcribe audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const playResponse = async (text, mood = null) => {
    try {
      setIsProcessing(true);
      
      const response = await axios.post(`${API}/voice/synthesize`, {
        text,
        mood: mood || detectedMood,
        language: currentLanguage
      });
      
      const { audio_base64, mood: usedMood, voice_description } = response.data;
      
      // Store for replay
      lastResponseRef.current = { audio_base64, mood: usedMood, voice_description };
      
      // Play audio
      if (audioRef.current && !isMuted) {
        audioRef.current.src = `data:audio/mp3;base64,${audio_base64}`;
        audioRef.current.play();
        setIsPlaying(true);
        
        toast.success(`Speaking in ${voice_description} voice`);
      }
    } catch (error) {
      console.error('Error playing response:', error);
      toast.error('Failed to generate speech');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    toast.success(isMuted ? 'Voice enabled' : 'Voice muted');
  };

  const replayLastResponse = () => {
    if (lastResponseRef.current && audioRef.current && !isMuted) {
      audioRef.current.src = `data:audio/mp3;base64,${lastResponseRef.current.audio_base64}`;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return {
    isRecording,
    isProcessing,
    isPlaying,
    isMuted,
    detectedMood,
    startRecording,
    stopRecording,
    playResponse,
    toggleMute,
    replayLastResponse
  };
};

export default VoiceControls;
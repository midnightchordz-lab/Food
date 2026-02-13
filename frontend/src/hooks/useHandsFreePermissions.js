/**
 * useHandsFreePermissions Hook
 * 
 * Centralized permission orchestration for hands-free cooking controls.
 * Handles all required permissions together after explicit user interaction:
 * - Camera (for gesture detection)
 * - Microphone (for voice commands)
 * - Speech Recognition (browser API)
 * 
 * Works on:
 * - Web (https / localhost only)
 * - iOS Capacitor
 * - Android Capacitor
 * 
 * CRITICAL: This is a pure permission layer.
 * It does NOT modify any cooking logic, UI structure, or navigation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Check for browser speech recognition support
const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

// Permission status enum
export const PermissionStatus = {
  IDLE: 'idle',           // Not yet requested
  REQUESTING: 'requesting', // Currently requesting
  GRANTED: 'granted',     // All permissions granted
  DENIED: 'denied',       // One or more denied
  UNSUPPORTED: 'unsupported', // Browser/platform doesn't support
  ERROR: 'error',         // Error during request
};

/**
 * Check if we're in a secure context (required for getUserMedia)
 */
const isSecureContext = () => {
  if (typeof window === 'undefined') return false;
  
  // Capacitor apps run in secure context
  if (Capacitor.isNativePlatform()) return true;
  
  // Check browser secure context
  return window.isSecureContext || 
         window.location.protocol === 'https:' ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
};

/**
 * Check if getUserMedia is available
 */
const hasGetUserMedia = () => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

/**
 * Request camera + microphone permissions together
 * Returns the media stream if successful
 */
const requestMediaPermissions = async () => {
  if (!hasGetUserMedia()) {
    throw new Error('getUserMedia not supported');
  }
  
  // Request both camera and audio together
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: { ideal: 'environment' }, // Prefer rear camera
    },
    audio: true, // Request microphone for voice commands
  });
  
  return stream;
};

/**
 * Test speech recognition availability
 * Note: This doesn't request permission, just checks support
 */
const checkSpeechRecognition = () => {
  if (!SpeechRecognition) {
    return { supported: false, error: 'SpeechRecognition not supported' };
  }
  return { supported: true };
};

/**
 * Stop all tracks in a media stream
 */
const stopStream = (stream) => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

/**
 * Main hook for hands-free permission orchestration
 */
export function useHandsFreePermissions() {
  const [status, setStatus] = useState(PermissionStatus.IDLE);
  const [cameraStream, setCameraStream] = useState(null);
  const [permissionDetails, setPermissionDetails] = useState({
    camera: null,
    microphone: null,
    speechRecognition: null,
  });
  const [errorMessage, setErrorMessage] = useState(null);
  
  const streamRef = useRef(null);
  const isRequestingRef = useRef(false);
  
  /**
   * Main permission request function
   * Call this only after explicit user interaction (tap/click)
   */
  const requestPermissions = useCallback(async () => {
    // Prevent concurrent requests
    if (isRequestingRef.current) {
      console.log('[HandsFreePermissions] Request already in progress');
      return false;
    }
    
    // Check secure context first
    if (!isSecureContext()) {
      console.error('[HandsFreePermissions] Not in secure context - HTTPS required');
      setStatus(PermissionStatus.UNSUPPORTED);
      setErrorMessage('Secure connection (HTTPS) required for camera and microphone');
      return false;
    }
    
    // Check getUserMedia support
    if (!hasGetUserMedia()) {
      console.error('[HandsFreePermissions] getUserMedia not supported');
      setStatus(PermissionStatus.UNSUPPORTED);
      setErrorMessage('Camera/microphone not supported on this browser');
      return false;
    }
    
    isRequestingRef.current = true;
    setStatus(PermissionStatus.REQUESTING);
    setErrorMessage(null);
    
    const details = {
      camera: null,
      microphone: null,
      speechRecognition: null,
    };
    
    try {
      console.log('[HandsFreePermissions] Requesting camera + microphone...');
      
      // Request camera + microphone together
      const stream = await requestMediaPermissions();
      
      // Check what we got
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      
      details.camera = hasVideo ? 'granted' : 'denied';
      details.microphone = hasAudio ? 'granted' : 'denied';
      
      console.log('[HandsFreePermissions] Media permissions:', {
        camera: details.camera,
        microphone: details.microphone,
      });
      
      // Check speech recognition
      const speechCheck = checkSpeechRecognition();
      details.speechRecognition = speechCheck.supported ? 'supported' : 'unsupported';
      
      console.log('[HandsFreePermissions] Speech recognition:', details.speechRecognition);
      
      // Store stream
      streamRef.current = stream;
      setCameraStream(stream);
      setPermissionDetails(details);
      
      // Determine overall status
      if (hasVideo && hasAudio) {
        setStatus(PermissionStatus.GRANTED);
        console.log('[HandsFreePermissions] All permissions granted');
        return true;
      } else {
        // Partial - stop the stream and report denied
        stopStream(stream);
        streamRef.current = null;
        setCameraStream(null);
        setStatus(PermissionStatus.DENIED);
        setErrorMessage('Camera or microphone access was denied');
        return false;
      }
      
    } catch (error) {
      console.error('[HandsFreePermissions] Permission error:', error.name, error.message);
      
      // Map common errors to user-friendly messages
      let userMessage = 'Could not access camera or microphone';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        userMessage = 'Camera/microphone access denied. Please allow access in your browser settings.';
        details.camera = 'denied';
        details.microphone = 'denied';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        userMessage = 'No camera or microphone found on this device';
        details.camera = 'not_found';
        details.microphone = 'not_found';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        userMessage = 'Camera or microphone is in use by another application';
        details.camera = 'busy';
        details.microphone = 'busy';
      } else if (error.name === 'OverconstrainedError') {
        userMessage = 'Camera settings not supported';
        details.camera = 'unsupported';
      } else if (error.name === 'SecurityError') {
        userMessage = 'Secure connection (HTTPS) required';
      }
      
      setPermissionDetails(details);
      setStatus(PermissionStatus.DENIED);
      setErrorMessage(userMessage);
      
      return false;
    } finally {
      isRequestingRef.current = false;
    }
  }, []);
  
  /**
   * Stop the camera stream and reset state
   */
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setCameraStream(null);
      console.log('[HandsFreePermissions] Camera stream stopped');
    }
  }, []);
  
  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    stopCameraStream();
    setStatus(PermissionStatus.IDLE);
    setPermissionDetails({
      camera: null,
      microphone: null,
      speechRecognition: null,
    });
    setErrorMessage(null);
  }, [stopCameraStream]);
  
  /**
   * Get current permission state for a specific feature
   */
  const getPermissionState = useCallback((feature) => {
    return permissionDetails[feature];
  }, [permissionDetails]);
  
  /**
   * Check if all required permissions are granted
   */
  const isFullyGranted = status === PermissionStatus.GRANTED;
  
  /**
   * Check if camera is available
   */
  const hasCameraAccess = permissionDetails.camera === 'granted';
  
  /**
   * Check if microphone is available
   */
  const hasMicrophoneAccess = permissionDetails.microphone === 'granted';
  
  /**
   * Check if speech recognition is available
   */
  const hasSpeechRecognition = permissionDetails.speechRecognition === 'supported';
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        stopStream(streamRef.current);
      }
    };
  }, []);
  
  return {
    // Status
    status,
    isFullyGranted,
    errorMessage,
    
    // Individual permission states
    hasCameraAccess,
    hasMicrophoneAccess,
    hasSpeechRecognition,
    permissionDetails,
    
    // Camera stream (for gesture detection)
    cameraStream,
    
    // Actions
    requestPermissions,
    stopCameraStream,
    reset,
    getPermissionState,
    
    // Platform info
    isNativePlatform: Capacitor.isNativePlatform(),
    isSecureContext: isSecureContext(),
  };
}

export default useHandsFreePermissions;

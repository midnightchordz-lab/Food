/**
 * useCameraPreview Hook
 * 
 * Provides live camera preview functionality for Live Cooking.
 * Handles camera stream initialization, permission, and cleanup.
 * Fails silently if camera is unavailable.
 * 
 * This is a passive layer - it only provides the video stream,
 * it does not affect any cooking logic.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export function useCameraPreview({ enabled = false, preferRearCamera = true }) {
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  // Get camera constraints
  const getCameraConstraints = useCallback(() => {
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    };

    // Prefer rear camera on mobile devices
    if (preferRearCamera) {
      constraints.video.facingMode = { ideal: 'environment' };
    }

    return constraints;
  }, [preferRearCamera]);

  // Initialize camera stream
  const initCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.log('[CameraPreview] getUserMedia not supported');
      setError('Camera not supported');
      return null;
    }

    try {
      const constraints = getCameraConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      setHasPermission(true);
      setIsActive(true);
      setError(null);
      
      console.log('[CameraPreview] Camera stream initialized');
      return stream;
    } catch (err) {
      // Fail silently - log but don't throw
      console.log('[CameraPreview] Camera access denied or unavailable:', err.name);
      setHasPermission(false);
      setError(err.name);
      return null;
    }
  }, [getCameraConstraints]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
      console.log('[CameraPreview] Camera stream stopped');
    }
    setIsActive(false);
  }, []);

  // Attach stream to video element
  const attachToVideo = useCallback((videoElement) => {
    if (videoElement && streamRef.current) {
      videoElement.srcObject = streamRef.current;
      videoRef.current = videoElement;
      return true;
    }
    return false;
  }, []);

  // Main effect - start/stop camera based on enabled prop
  useEffect(() => {
    if (enabled) {
      initCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [enabled, initCamera, stopCamera]);

  return {
    isActive,
    hasPermission,
    error,
    stream: streamRef.current,
    attachToVideo,
    videoRef,
  };
}

export default useCameraPreview;

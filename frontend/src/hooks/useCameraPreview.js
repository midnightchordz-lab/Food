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
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null);

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

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
      console.log('[CameraPreview] Camera stream stopped');
    }
    setStream(null);
    setIsActive(false);
  }, []);

  // Initialize camera stream
  const initCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.log('[CameraPreview] getUserMedia not supported');
      setError('Camera not supported');
      return;
    }

    // Already have a stream
    if (streamRef.current) {
      return;
    }

    try {
      const constraints = getCameraConstraints();
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = newStream;
      setStream(newStream);
      setHasPermission(true);
      setIsActive(true);
      setError(null);
      
      console.log('[CameraPreview] Camera stream initialized');
    } catch (err) {
      // Fail silently - log but don't throw
      console.log('[CameraPreview] Camera access denied or unavailable:', err.name);
      setHasPermission(false);
      setError(err.name);
    }
  }, [getCameraConstraints]);

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
    stream,
  };
}

export default useCameraPreview;

import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VoiceButton = ({ 
  isRecording, 
  isProcessing, 
  isMuted,
  onStartRecording, 
  onStopRecording,
  onToggleMute,
  size = 'default',
  variant = 'outline'
}) => {
  return (
    <div className="flex gap-2" data-testid="voice-controls">
      {/* Recording Button */}
      <Button
        onClick={isRecording ? onStopRecording : onStartRecording}
        disabled={isProcessing}
        size={size}
        variant={isRecording ? 'default' : variant}
        className={`rounded-full transition-all ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'hover:scale-105'
        }`}
        data-testid="record-button"
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={20} />
        ) : isRecording ? (
          <>
            <MicOff size={20} className="mr-2" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <Mic size={20} className="mr-2" />
            <span>Voice</span>
          </>
        )}
      </Button>

      {/* Mute Toggle */}
      <Button
        onClick={onToggleMute}
        size={size}
        variant="ghost"
        className="rounded-full"
        data-testid="mute-button"
      >
        {isMuted ? (
          <VolumeX size={20} className="text-muted-foreground" />
        ) : (
          <Volume2 size={20} className="text-primary" />
        )}
      </Button>
    </div>
  );
};

export default VoiceButton;
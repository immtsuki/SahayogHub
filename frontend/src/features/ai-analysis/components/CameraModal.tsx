import { useEffect, useRef, useState } from 'react';

interface CameraModalProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export default function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [ready, setReady]     = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    let active = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());

    navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false,
    }).then((stream) => {
      if (!active) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    }).catch(() => {
      if (active) setError('Camera access denied or unavailable. Please allow camera permissions.');
    });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  function capture() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  }

  return (
    <div className="fixed left-0 right-0 bottom-0 top-0 md:top-14 z-[9999] bg-black flex flex-col overflow-hidden">
      {/* Video preview */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
            <p className="text-white text-sm">{error}</p>
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-xl transition-colors cursor-pointer"
          aria-label="Close camera"
        >
          ×
        </button>

        {/* Flip camera */}
        <button
          onClick={() => {
            setReady(false);
            setError(null);
            setFacingMode((f) => f === 'environment' ? 'user' : 'environment');
          }}
          className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Flip camera"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
        </button>



        {/* Shutter button — overlaid on video, above mobile nav */}
        <div
          className="absolute left-0 right-0 flex justify-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}
        >
          <button
            onClick={capture}
            disabled={!ready}
            className="w-16 h-16 rounded-full bg-white disabled:opacity-40 flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
            aria-label="Take photo"
          >
            <div className="w-12 h-12 rounded-full border-4 border-gray-300" />
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

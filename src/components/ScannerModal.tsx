import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface ScannerModalProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function ScannerModal({ onScan, onClose }: ScannerModalProps) {
  const [hasCameras, setHasCameras] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // Check permissions and available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setHasCameras(true);
          startScanner();
        } else {
          setHasCameras(false);
          setError("No cameras found on this device.");
        }
      })
      .catch((err) => {
        setHasCameras(false);
        setError("Camera permission denied or camera not found.");
      });

    return () => {
      stopScanner();
    };
  }, [facingMode]);

  const startScanner = () => {
    // If there's already an instance running, stop it and destroy it
    stopScanner().then(() => {
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        
        scanner.start(
          { facingMode: facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 100 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            scanner.stop().then(() => {
              onScan(decodedText);
            }).catch(e => {
                onScan(decodedText);
            });
          },
          (errorMessage) => {
            // Ignore ongoing read errors as they just mean "no code in view yet"
          }
        ).catch((err) => {
          setError("Failed to start scanner.");
          console.error(err);
        });
    });
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
         console.warn("Error stopping scanner", err);
      }
    }
  };

  const flipCamera = () => {
     setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
        <div className="p-4 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-2 text-white">
            <Camera className="w-5 h-5 text-zinc-400" />
            <h3 className="font-bold tracking-tight">Scan Barcode / IMEI</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 relative bg-black aspect-[4/3] flex items-center justify-center min-h-[300px]">
          {error ? (
             <div className="text-rose-500 text-sm text-center p-6 bg-rose-500/10 rounded-xl m-4">
                {error}
             </div>
          ) : (
             <div id="reader" className="w-full h-full"></div>
          )}
          {!error && !scannerRef.current && (
             <div className="absolute inset-0 flex items-center justify-center flex-col text-zinc-500">
                 <Loader2 className="w-8 h-8 animate-spin mb-4" />
                 <p className="font-semibold text-sm">Initializing Camera...</p>
             </div>
          )}
        </div>

        <div className="p-6 bg-zinc-950 flex flex-col gap-4">
           <p className="text-xs font-semibold text-zinc-500 text-center">Center the barcode inside the target area to scan.</p>
           <Button onClick={flipCamera} variant="outline" className="w-full bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <RefreshCw className="w-4 h-4 mr-2" /> Flip Camera
           </Button>
        </div>
      </div>
    </div>
  );
}

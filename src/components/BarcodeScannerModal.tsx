import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, Keyboard } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedEan: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualEanInput, setManualEanInput] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    // Delay start slightly to allow DOM element to render
    const timer = setTimeout(() => {
      startScanner();
    }, 300);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    setScannerError(null);
    setIsScanning(true);

    try {
      const element = document.getElementById('barcode-reader');
      if (!element) return;

      if (html5QrcodeRef.current) {
        await stopScanner();
      }

      const html5Qrcode = new Html5Qrcode('barcode-reader');
      html5QrcodeRef.current = html5Qrcode;

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.777778,
      };

      await html5Qrcode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // Play audio feedback beep if supported
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            osc.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
          } catch (err) {
            // Audio context optional
          }

          stopScanner();
          onScanSuccess(decodedText.trim());
        },
        () => {
          // Ignore scanning frames error logs
        }
      );
    } catch (err: any) {
      console.warn('Câmera indisponível ou permissão negada:', err);
      setIsScanning(false);
      setScannerError(
        'Não foi possível acessar a câmera do dispositivo. Verifique as permissões do navegador ou digite o código EAN manualmente.'
      );
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Erro ao encerrar scanner:', err);
      } finally {
        html5QrcodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEanInput.trim()) return;
    stopScanner();
    onScanSuccess(manualEanInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-slate-100">Escanear Código EAN</h3>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Camera Viewport Container */}
          <div className="relative bg-black rounded-2xl overflow-hidden min-h-[220px] flex items-center justify-center border border-slate-800">
            <div id="barcode-reader" className="w-full"></div>

            {isScanning && (
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Câmera Ativa</span>
              </div>
            )}
          </div>

          {/* Scanner Error Notice */}
          {scannerError && (
            <div className="p-3 bg-amber-950/50 border border-amber-800/80 rounded-xl text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p>{scannerError}</p>
                <button
                  onClick={startScanner}
                  className="mt-2 text-xs font-bold text-amber-400 underline hover:text-amber-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <p className="text-xs text-slate-400 text-center">
            Aponta a câmera para o código de barras (EAN-13, EAN-8) no rótulo do produto.
          </p>

          {/* Manual EAN Input Fallback */}
          <div className="pt-2 border-t border-slate-800">
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-amber-400" />
                Ou digite o código EAN manualmente:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: 7891000100103"
                  value={manualEanInput}
                  onChange={(e) => setManualEanInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow active:scale-95"
                >
                  Buscar EAN
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 text-right">
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

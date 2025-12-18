import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { motion } from 'framer-motion';
import { X, ScanLine } from 'lucide-react';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onClose }) => {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Config for the scanner
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };

        const scanner = new Html5QrcodeScanner(
            "reader",
            config,
      /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                onScanSuccess(decodedText);
                scanner.clear();
            },
            (errorMessage) => {
                // Ignored for now to prevent spamming logs
                // console.log(errorMessage);
            }
        );

        return () => {
            scanner.clear().catch(err => console.error("Failed to clear scanner", err));
        };
    }, [onScanSuccess]);

    return (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative"
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <ScanLine className="text-cyan-400" /> Scan Data Plate
                    </h3>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 bg-black relative">
                    <div id="reader" className="w-full rounded-xl overflow-hidden" />
                    <p className="text-center text-slate-400 text-xs mt-4">
                        Align QR Code or Barcode within the frame.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

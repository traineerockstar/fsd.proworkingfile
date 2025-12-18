import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, MapPin, Clock, Phone, Upload,
    Sparkles, FileText, CheckCircle2, AlertTriangle, X, Scan
} from 'lucide-react';
import { Job } from '../context/JobContext';
import { BarcodeScanner } from './BarcodeScanner';
import { analyzeJobSheet } from '../services/geminiService';
import { useJobs } from '../context/JobContext';
import { imageService } from '../services/imageService';

interface JobDetailProps {
    job: Job;
    onBack: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

export const JobDetail: React.FC<JobDetailProps> = ({ job, onBack }) => {
    const { updateJob } = useJobs();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [serialNumber, setSerialNumber] = useState(job.serialNumber || '');
    const [aiError, setAiError] = useState<string | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setAnalysisResult(null); // Clear previous results
            setAiError(null);
        }
    };

    const handleScanSuccess = (decodedText: string) => {
        setSerialNumber(decodedText);
        updateJob(job.id, { serialNumber: decodedText }); // Save instantly
        setIsScanning(false);
        navigator.clipboard.writeText(decodedText).then(() => {
            alert(`Scanned: ${decodedText}. Copied to clipboard!`);
        });
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setIsAnalyzing(true);
        setAiError(null);

        try {
            const base64 = await fileToBase64(file);
            const data = await analyzeJobSheet(base64);

            console.log("Gemini Analysis Result:", data);

            // Update Context
            updateJob(job.id, {
                modelNumber: data.modelNumber || job.modelNumber,
                serialNumber: data.serialNumber || job.serialNumber,
                detectedProduct: data.detectedProduct,
                partsUsed: data.partsUsed,
                engineerNotes: data.engineerNotes
                    ? (job.engineerNotes ? job.engineerNotes + "\n" + data.engineerNotes : data.engineerNotes)
                    : job.engineerNotes
            });

            // Update local state for immediate feedback if needed,
            // but the parent 'job' prop should update via context.
            if (data.serialNumber) setSerialNumber(data.serialNumber);

            setAnalysisResult("Completed");

        } catch (error) {
            console.error("Analysis Failed:", error);
            setAiError("Failed to analyze image. Please check API Key or Internet.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const [productImage, setProductImage] = useState<string | null>(null);

    React.useEffect(() => {
        const loadImg = async () => {
            const query = job.modelNumber || job.detectedProduct;
            if (query) {
                const url = await imageService.searchProductImage(query + " appliance");
                if (url) setProductImage(url);
            }
        };
        loadImg();
    }, [job.modelNumber, job.detectedProduct]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <AnimatePresence>
                {isScanning && (
                    <BarcodeScanner
                        onScanSuccess={handleScanSuccess}
                        onClose={() => setIsScanning(false)}
                    />
                )}
            </AnimatePresence>

            {/* Dynamic Image Header */}
            <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/10 group">
                {productImage && (
                    <div className="absolute inset-0">
                        <img src={productImage} alt="Machine" className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                    </div>
                )}

                <div className="relative p-8 flex items-center gap-4 z-10">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/20 text-white transition-all shadow-lg"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-md">{job.customerName}</h2>
                        <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                            <span className="uppercase tracking-wider">Job ID: {job.id}</span>
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <span className="capitalize">{job.priority} Priority</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Col: Job Info */}
                <div className="space-y-6">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                            <MapPin size={18} className="text-cyan-400" /> Location
                        </h3>
                        <p className="text-slate-400 leading-relaxed">{job.address}</p>
                        {job.travelTime && (
                            <div className="flex items-center gap-3 mt-2 text-sm text-cyan-400 bg-cyan-500/10 p-3 rounded-lg border border-cyan-500/20">
                                <span>🚗 {job.travelTime} drive</span>
                                <button className="ml-auto px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs transition-colors">
                                    Start Route
                                </button>
                            </div>
                        )}

                        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mt-6">
                            <Clock size={18} className="text-cyan-400" /> Schedule
                        </h3>
                        <p className="text-slate-400">{job.timeSlot}</p>

                        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mt-6">
                            <Phone size={18} className="text-cyan-400" /> Contact
                        </h3>
                        <p className="text-slate-400">+44 7700 900000</p>
                    </div>

                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                            Machine Details
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Serial Number</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={serialNumber}
                                        onChange={(e) => setSerialNumber(e.target.value)}
                                        placeholder="Scan or Enter Serial"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                                    />
                                    <button
                                        onClick={() => setIsScanning(true)}
                                        className="p-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl transition-all"
                                    >
                                        <Scan size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 rounded-3xl p-6">
                        <h3 className="text-amber-400 font-bold flex items-center gap-2 mb-2">
                            <AlertTriangle size={18} /> Engineer Notes
                        </h3>
                        <p className="text-sm text-amber-200/80">
                            Customer reported intermittent boiler fault (F1). Verify gas pressure and check flue integrity.
                        </p>
                    </div>
                </div>

                {/* Right Col: AI Workspace */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                        {/* Decorative background */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold text-white mb-2">Job Sheet Processing</h3>
                            <p className="text-slate-400 mb-8">Upload the handwritten job sheet. Gemini AI will extract the data.</p>

                            {!file ? (
                                <label className="border-2 border-dashed border-white/10 rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group">
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                    <div className="p-4 rounded-full bg-white/5 group-hover:bg-cyan-500/20 mb-4 transition-colors">
                                        <Upload size={24} className="text-slate-400 group-hover:text-cyan-400" />
                                    </div>
                                    <span className="text-slate-400 font-medium group-hover:text-cyan-300">Tap to upload Job Sheet</span>
                                    <span className="text-xs text-slate-600 mt-2">Supports JPG, PNG</span>
                                </label>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/10">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-cyan-500/20 rounded-lg">
                                                <FileText className="text-cyan-400" size={24} />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{file.name}</p>
                                                <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setFile(null); setAnalysisResult(null); }} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {!analysisResult && !job.detectedProduct ? (
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={isAnalyzing}
                                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-bold text-white shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
                                        >
                                            {isAnalyzing ? (
                                                <>
                                                    <Sparkles className="animate-spin" /> Analyzing via Gemini...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles /> Analyze Job Sheet
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        job.detectedProduct ? (
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400 mt-1">
                                                        <CheckCircle2 size={24} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-emerald-400 mb-1">Analysis Complete</h4>
                                                        <p className="text-slate-300 text-sm mb-4">Gemini successfully extracted data from the document.</p>

                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div className="bg-black/30 p-3 rounded-lg border border-emerald-500/10">
                                                                <span className="block text-slate-500 text-xs uppercase">Detected Product</span>
                                                                <span className="text-white font-mono">{job.detectedProduct}</span>
                                                            </div>
                                                            <div className="bg-black/30 p-3 rounded-lg border border-emerald-500/10">
                                                                <span className="block text-slate-500 text-xs uppercase">Parts Used</span>
                                                                <span className="text-white font-mono">{job.partsUsed?.join(', ') || 'None'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-white/5 rounded-xl text-center text-slate-400">
                                                Data processed. Updating records...
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { uploadKnowledgeFile, ensureKnowledgeFolder } from '../services/googleDriveService';

interface KnowledgeUploadProps {
    accessToken: string;
}

export const KnowledgeUpload: React.FC<KnowledgeUploadProps> = ({ accessToken }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        setStatus('idle');
        setMessage('');

        try {
            await ensureKnowledgeFolder(accessToken); // Ensure folder exists first
            await uploadKnowledgeFile(accessToken, file);
            setStatus('success');
            setMessage(`Successfully trained Oscar on: ${file.name}`);
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage('Failed to upload. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            uploadFile(e.dataTransfer.files[0]);
        }
    }, [accessToken]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            uploadFile(e.target.files[0]);
        }
    };

    return (
        <div className="w-full">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <Upload size={16} /> Knowledge Base Training
            </h3>
            <p className="text-slate-400 text-xs mb-4">
                Drag & Drop PDF Manuals, Service Guides, or Text files here. Oscar will read them to answer your questions.
            </p>

            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                    ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
                    ${status === 'success' ? 'border-emerald-500/50' : ''}
                    ${status === 'error' ? 'border-red-500/50' : ''}
                `}
            >
                <input
                    type="file"
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".pdf,.txt,.md,.json,.csv"
                />

                <div className="flex flex-col items-center gap-3">
                    {isUploading ? (
                        <Loader2 size={32} className="text-indigo-400 animate-spin" />
                    ) : status === 'success' ? (
                        <CheckCircle size={32} className="text-emerald-400" />
                    ) : status === 'error' ? (
                        <AlertCircle size={32} className="text-red-400" />
                    ) : (
                        <FileText size={32} className="text-slate-500" />
                    )}

                    <div className="text-sm font-medium text-slate-300">
                        {isUploading ? 'Uploading & Indexing...' :
                            status === 'success' ? 'Knowledge Added!' :
                                status === 'error' ? 'Upload Failed' :
                                    'Drop file or click to browse'}
                    </div>

                    {message && (
                        <div className={`text-xs ${status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

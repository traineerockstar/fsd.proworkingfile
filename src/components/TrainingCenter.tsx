
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Book, RefreshCw, Search, Download, FileText, CheckCircle2 } from 'lucide-react';
import { knowledgeService } from '../services/knowledgeService';
import { KnowledgeItem } from '../types';
import { listFilesInFolder } from '../services/googleDriveService';
import { useJobs } from '../context/JobContext';

interface TrainingCenterProps {
    accessToken: string;
    onClose: () => void;
}

export const TrainingCenter: React.FC<TrainingCenterProps> = ({ accessToken, onClose }) => {
    const [manuals, setManuals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchModel, setSearchModel] = useState('');
    const [searchResult, setSearchResult] = useState<KnowledgeItem | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const fetchManuals = async () => {
        setIsLoading(true);
        try {
            const files = await listFilesInFolder(accessToken, 'MANUALS');
            setManuals(files);
        } catch (error) {
            console.error("Failed to list manuals", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchManuals();
    }, [accessToken]);

    const handleSearch = async () => {
        if (!searchModel.trim()) return;
        setIsSearching(true);
        setSearchResult(null);
        try {
            const result = await knowledgeService.findManual(accessToken, searchModel);
            setSearchResult(result);
            if (result) {
                // Refresh list if it was a new save
                fetchManuals();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-slate-950 border-l border-white/10 z-50 flex flex-col shadow-2xl"
        >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Book size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Training Center</h2>
                        <p className="text-xs text-slate-400">Knowledge Graph & Manuals</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* Search Section */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Find / Fetch Manual</h3>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                value={searchModel}
                                onChange={(e) => setSearchModel(e.target.value)}
                                placeholder="Enter Model Number (e.g. WA-2000)"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition-colors disabled:opacity-50"
                        >
                            {isSearching ? <RefreshCw className="animate-spin" /> : 'Fetch'}
                        </button>
                    </div>

                    {/* Result */}
                    {searchResult && (
                        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="text-emerald-400" size={20} />
                                <div>
                                    <p className="text-sm font-bold text-emerald-100">Manual Found</p>
                                    <p className="text-xs text-emerald-300/70">{searchResult.title}</p>
                                </div>
                            </div>
                            {searchResult.url && (
                                <a href={searchResult.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500/30">
                                    <Download size={16} />
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* Library List */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Drive Library</h3>
                        <button
                            onClick={fetchManuals}
                            disabled={isLoading}
                            className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                            Bulk Sync
                        </button>
                    </div>

                    <div className="space-y-2">
                        {manuals.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-sm italic">
                                No manuals found in FSD_PRO_DATA/MANUALS
                            </div>
                        ) : (
                            manuals.map((file) => (
                                <div key={file.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between group hover:border-white/10 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                                            <FileText size={16} />
                                        </div>
                                        <span className="text-sm text-slate-300 font-mono truncate max-w-[200px]">{file.name}</span>
                                    </div>
                                    <span className="text-[10px] px-2 py-1 rounded bg-black/40 text-slate-500">DRIVE</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </motion.div>
    );
};

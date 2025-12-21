import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Server,
    HardDrive,
    FolderOpen,
    Trash2,
    ExternalLink,
    RefreshCw,
    ChevronRight,
    ChevronDown,
    File,
    Folder,
    CheckSquare,
    Square,
    AlertTriangle
} from 'lucide-react';
import { listAppFiles, deleteAppFile, getAppFolderLink, AppFileItem } from '../services/driveStorage';
import { toast } from 'sonner';

interface IntegrationsPageProps {
    accessToken: string;
    onBack: () => void;
}

type View = 'main' | 'files';

// Recursive File Tree Item Component
interface FileTreeItemProps {
    item: AppFileItem;
    depth: number;
    selectedIds: Set<string>;
    expandedFolders: Set<string>;
    toggleSelection: (id: string) => void;
    toggleFolder: (id: string) => void;
    formatDate: (dateStr?: string) => string;
    formatSize: (bytes?: string) => string;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
    item,
    depth,
    selectedIds,
    expandedFolders,
    toggleSelection,
    toggleFolder,
    formatDate,
    formatSize
}) => {
    const isExpanded = expandedFolders.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const paddingLeft = 16 + (depth * 24); // Increase indent with depth

    return (
        <div>
            <div
                className={`flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors border-b border-slate-100 ${selectedIds.has(item.id) ? 'bg-purple-50' : ''
                    }`}
                style={{ paddingLeft: `${paddingLeft}px` }}
            >
                <button
                    onClick={() => toggleSelection(item.id)}
                    className="text-slate-400 hover:text-purple-500 shrink-0"
                >
                    {selectedIds.has(item.id)
                        ? <CheckSquare size={18} className="text-purple-500" />
                        : <Square size={18} />
                    }
                </button>

                {item.type === 'folder' ? (
                    <button
                        onClick={() => toggleFolder(item.id)}
                        className="flex items-center gap-1 text-amber-500 shrink-0"
                    >
                        {hasChildren && (
                            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        )}
                        <Folder size={18} />
                    </button>
                ) : (
                    <File size={18} className="text-blue-500 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700 text-sm block truncate">
                        {item.name}
                    </span>
                    {hasChildren && (
                        <span className="text-xs text-slate-400">
                            {item.children!.length} items
                        </span>
                    )}
                </div>

                <span className="text-xs text-slate-400 hidden md:block shrink-0">
                    {formatDate(item.modifiedTime)}
                </span>

                <span className="text-xs text-slate-400 hidden md:block w-16 text-right shrink-0">
                    {formatSize(item.size)}
                </span>
            </div>

            {/* Recursively render children */}
            {item.type === 'folder' && isExpanded && hasChildren && (
                <div className="bg-slate-50/50">
                    {item.children!.map(child => (
                        <FileTreeItem
                            key={child.id}
                            item={child}
                            depth={depth + 1}
                            selectedIds={selectedIds}
                            expandedFolders={expandedFolders}
                            toggleSelection={toggleSelection}
                            toggleFolder={toggleFolder}
                            formatDate={formatDate}
                            formatSize={formatSize}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ accessToken, onBack }) => {
    const [view, setView] = useState<View>('main');
    const [loading, setLoading] = useState(false);
    const [folderLink, setFolderLink] = useState<string | null>(null);
    const [files, setFiles] = useState<AppFileItem[]>([]);
    const [rootId, setRootId] = useState<string>('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    // Load folder link on mount
    useEffect(() => {
        const loadFolderLink = async () => {
            const link = await getAppFolderLink(accessToken);
            setFolderLink(link);
        };
        loadFolderLink();
    }, [accessToken]);

    // Load files when switching to files view
    const loadFiles = async () => {
        setLoading(true);
        try {
            const result = await listAppFiles(accessToken);
            setFiles(result.files);
            setRootId(result.rootId);
        } catch (error) {
            console.error('Failed to load files:', error);
            toast.error('Failed to load files from Drive');
        } finally {
            setLoading(false);
        }
    };

    const handleViewFiles = async () => {
        setView('files');
        await loadFiles();
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleFolder = (id: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;

        const confirmed = confirm(`Delete ${selectedIds.size} item(s)? This cannot be undone.`);
        if (!confirmed) return;

        setDeleting(true);
        let successCount = 0;

        for (const id of selectedIds) {
            const success = await deleteAppFile(accessToken, id);
            if (success) successCount++;
        }

        toast.success(`Deleted ${successCount} item(s)`);
        setSelectedIds(new Set());
        await loadFiles();
        setDeleting(false);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '--';
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatSize = (bytes?: string) => {
        if (!bytes) return '--';
        const b = parseInt(bytes);
        if (b < 1024) return `${b} B`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
        return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={view === 'files' ? () => setView('main') : onBack}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-purple-700">
                        {view === 'main' ? 'Integrations' : 'Created Files & Folders'}
                    </h2>
                    <p className="text-slate-500 text-sm">
                        {view === 'main'
                            ? 'Manage connected services and storage'
                            : 'Files created by FSD.PRO in your Google Drive'}
                    </p>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {view === 'main' && (
                    <motion.div
                        key="main"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        {/* Google Drive Section */}
                        <div className="bg-sky-50 border border-sky-100 rounded-3xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-white rounded-xl shadow-sm">
                                    <HardDrive size={24} className="text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-purple-700">Google Drive</h3>
                                    <p className="text-sm text-slate-500">Connected via Google OAuth</p>
                                </div>
                                <span className="ml-auto px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                                    Connected
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white rounded-xl p-4 border border-sky-100">
                                    <label className="block text-sm font-medium text-purple-600 mb-2">
                                        Data Folder Location
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 bg-slate-50 px-4 py-2 rounded-lg text-sm font-mono text-slate-600 truncate">
                                            {folderLink || 'FSD_PRO_DATA'}
                                        </code>
                                        {folderLink && (
                                            <a
                                                href={folderLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        All schedules, jobs, and app data are stored in this folder
                                    </p>
                                </div>

                                {/* View Created Files Button */}
                                <button
                                    onClick={handleViewFiles}
                                    className="w-full flex items-center justify-between p-4 bg-white rounded-xl border border-sky-100 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <FolderOpen size={20} className="text-purple-500" />
                                        <div className="text-left">
                                            <span className="block font-medium text-slate-700">Created Files & Folders</span>
                                            <span className="text-sm text-slate-500">View and manage app-created content</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-400 group-hover:text-purple-500 transition-colors" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {view === 'files' && (
                    <motion.div
                        key="files"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-4"
                    >
                        {/* Action Bar */}
                        <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-slate-200">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={loadFiles}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                                >
                                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                                <span className="text-sm text-slate-500">
                                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${files.length} items`}
                                </span>
                            </div>
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={handleDeleteSelected}
                                    disabled={deleting}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors font-medium"
                                >
                                    <Trash2 size={16} />
                                    {deleting ? 'Deleting...' : 'Delete Selected'}
                                </button>
                            )}
                        </div>

                        {/* Files List */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
                                </div>
                            ) : files.length === 0 ? (
                                <div className="text-center py-20 text-slate-400">
                                    <FolderOpen size={48} className="mx-auto mb-4 text-slate-300" />
                                    <p>No files found in FSD_PRO_DATA</p>
                                </div>
                            ) : (
                                <div>
                                    {files.map(file => (
                                        <FileTreeItem
                                            key={file.id}
                                            item={file}
                                            depth={0}
                                            selectedIds={selectedIds}
                                            expandedFolders={expandedFolders}
                                            toggleSelection={toggleSelection}
                                            toggleFolder={toggleFolder}
                                            formatDate={formatDate}
                                            formatSize={formatSize}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Warning */}
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <strong>Caution:</strong> Deleting schedule folders will permanently remove job data for those dates.
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default IntegrationsPage;

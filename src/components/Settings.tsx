import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Settings as SettingsIcon,
    Database,
    Brain,
    Save,
    Trash2,
    RefreshCw,
    Server,
    Key,
    ToggleLeft
} from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import { KnowledgeUpload } from './KnowledgeUpload';

interface SettingsProps {
    onClose?: () => void;
    accessToken: string;
}

const Settings: React.FC<SettingsProps> = ({ onClose, accessToken }) => {
    const {
        settings,
        updateSettings,
        resetSettings
    } = useJobContext();

    const [localSettings, setLocalSettings] = useState(settings);
    const [isDirty, setIsDirty] = useState(false);

    const handleChange = (key: string, value: any) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
    };

    const handleSave = () => {
        updateSettings(localSettings);
        setIsDirty(false);
        if (onClose) onClose();
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            resetSettings();
            setLocalSettings(settings); // settings will be defaults after reset
            setIsDirty(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="max-w-4xl mx-auto p-6 space-y-8"
        >
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <SettingsIcon className="w-8 h-8 text-indigo-400" />
                        System Configuration
                    </h2>
                    <p className="text-slate-400 mt-2">Manage AI behavior, integrations, and system defaults.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                    >
                        <RefreshCw size={18} />
                        Reset Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isDirty}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all ${isDirty
                            ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                            }`}
                    >
                        <Save size={18} />
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Configuration Section */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Brain size={24} className="text-purple-400" />
                        AI Model Configuration
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Default Model
                            </label>
                            <select
                                value={localSettings.defaultModel || 'gemini-2.5-flash'}
                                onChange={(e) => handleChange('defaultModel', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                                <option value="gemini-pro">Gemini Pro (Legacy)</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-2">
                                The Flash model is optimized for speed and multimodal input handling.
                            </p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                            <div>
                                <span className="block text-white font-medium">Auto-Ingest</span>
                                <span className="text-sm text-slate-500">Automatically process images on upload</span>
                            </div>
                            <button
                                onClick={() => handleChange('autoIngest', !localSettings.autoIngest)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.autoIngest ? 'bg-indigo-500' : 'bg-slate-600'
                                    }`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.autoIngest ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Integration Settings */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Server size={24} className="text-emerald-400" />
                        Integrations
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Google Drive Folder ID (Optional)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={localSettings.driveFolderId || ''}
                                    onChange={(e) => handleChange('driveFolderId', e.target.value)}
                                    placeholder="1abc-xyz..."
                                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                If provided, generated reports will be saved to this folder.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                API Key Override (Advanced)
                            </label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <input
                                    type="password"
                                    value={localSettings.apiKey || ''}
                                    onChange={(e) => handleChange('apiKey', e.target.value)}
                                    placeholder="Use system default"
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Knowledge Base Section */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-3xl p-6">
                <h3 className="text-xl font-bold text-indigo-300 mb-6 flex items-center gap-2">
                    <Database size={24} /> Oscar's Knowledge Base
                </h3>
                <p className="text-indigo-200/60 mb-6">
                    Manage the manuals, guides, and error code databases that Oscar uses to diagnose issues.
                </p>

                {/* Placeholder for future Knowledge Base UI */}
                <KnowledgeUpload accessToken={accessToken} />
            </div>

        </motion.div>
    );
};

export default Settings;

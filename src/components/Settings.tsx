import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings as SettingsIcon,
    Database,
    Brain,
    Save,
    Trash2,
    RefreshCw,
    Server,
    Key,
    ToggleLeft,
    Home,
    ChevronRight,
    HardDrive
} from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import { KnowledgeUpload } from './KnowledgeUpload';
import { IntegrationsPage } from './IntegrationsPage';

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
    const [showIntegrations, setShowIntegrations] = useState(false);

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
            setLocalSettings(settings);
            setIsDirty(false);
        }
    };

    // Show IntegrationsPage when clicked
    if (showIntegrations) {
        return (
            <IntegrationsPage
                accessToken={accessToken}
                onBack={() => setShowIntegrations(false)}
            />
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="max-w-4xl mx-auto p-6 space-y-8"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-purple-700 flex items-center gap-3">
                        <SettingsIcon className="w-8 h-8 text-purple-500" />
                        System Configuration
                    </h2>
                    <p className="text-slate-500 mt-2">Manage AI behavior, integrations, and system defaults.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors border border-slate-200"
                    >
                        <RefreshCw size={18} />
                        Reset Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isDirty}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all ${isDirty
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            }`}
                    >
                        <Save size={18} />
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Configuration Section */}
                <div className="bg-sky-50 border border-sky-100 rounded-3xl p-6">
                    <h3 className="text-xl font-bold text-purple-700 mb-6 flex items-center gap-2">
                        <Brain size={24} className="text-purple-500" />
                        AI Model Configuration
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-purple-600 mb-2">
                                Default Model
                            </label>
                            <select
                                value={localSettings.defaultModel || 'gemini-2.5-flash'}
                                onChange={(e) => handleChange('defaultModel', e.target.value)}
                                className="w-full bg-white border border-sky-200 text-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                                <option value="gemini-pro">Gemini Pro (Legacy)</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-2">
                                The Flash model is optimized for speed and multimodal input handling.
                            </p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-sky-200">
                            <div>
                                <span className="block text-slate-700 font-medium">Auto-Ingest</span>
                                <span className="text-sm text-slate-500">Automatically process images on upload</span>
                            </div>
                            <button
                                onClick={() => handleChange('autoIngest', !localSettings.autoIngest)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.autoIngest ? 'bg-purple-500' : 'bg-slate-300'
                                    }`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${localSettings.autoIngest ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-purple-600 mb-2 flex items-center gap-2">
                                <Home size={16} />
                                Home Postcode
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={localSettings.homePostcode || ''}
                                    onChange={(e) => handleChange('homePostcode', e.target.value.toUpperCase())}
                                    placeholder="e.g., S75 1EP"
                                    className="flex-1 bg-white border border-sky-200 text-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm uppercase"
                                />
                                <button
                                    onClick={() => {
                                        updateSettings({ homePostcode: localSettings.homePostcode });
                                    }}
                                    className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors shadow-sm"
                                >
                                    Set
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Used to calculate daily mileage (Home → Jobs → Home)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Integration Settings - Clickable Card */}
                <button
                    onClick={() => setShowIntegrations(true)}
                    className="w-full bg-sky-50 border border-sky-100 rounded-3xl p-6 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left group"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                                <HardDrive size={24} className="text-purple-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-purple-700 flex items-center gap-2">
                                    Integrations
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Google Drive connection, manage app files
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={24} className="text-slate-400 group-hover:text-purple-500 transition-colors" />
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                            Connected
                        </span>
                        <span className="text-xs text-slate-400">
                            Google Drive • FSD_PRO_DATA
                        </span>
                    </div>
                </button>
            </div>

            {/* Knowledge Base Section */}
            <div className="bg-purple-50 border border-purple-100 rounded-3xl p-6">
                <h3 className="text-xl font-bold text-purple-700 mb-6 flex items-center gap-2">
                    <Database size={24} className="text-purple-500" /> Oscar's Knowledge Base
                </h3>
                <p className="text-slate-600 mb-6">
                    Manage the manuals, guides, and error code databases that Oscar uses to diagnose issues.
                </p>

                {/* Placeholder for future Knowledge Base UI */}
                <KnowledgeUpload accessToken={accessToken} />
            </div>

        </motion.div>
    );
};

export default Settings;

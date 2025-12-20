import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Wrench, Search, ShieldCheck, AlertCircle, ArrowRight, BookOpen, Layers, Globe, Database } from 'lucide-react';
import { Job } from '../context/JobContext';
import { chatWithOscar } from '../services/geminiService';

// --- TYPES ---
interface Message {
    id: string;
    text: string;
    sender: 'user' | 'oscar';
    timestamp: Date;
    sources?: { type: 'drive' | 'web', name: string, link: string }[];
}

interface OscarChatProps {
    job?: Job;
    onClose: () => void;
    accessToken: string;
}

export const OscarChat: React.FC<OscarChatProps> = ({ job, onClose, accessToken }) => {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: string, parts: { text: string }[] }[]>([]);

    // INITIALIZATION
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            text: `👋 I'm ready. I have context on **${job?.modelNumber || job?.detectedProduct || 'the general system'}**.
            
Ask me about:
*   Standard fault codes
*   Parts and inventory
*   Manuals and diagrams`,
            sender: 'oscar',
            timestamp: new Date()
        }
    ]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // CONTEXT SWITCHING LOGIC
    useEffect(() => {
        const switchMsg: Message = {
            id: `sys-${Date.now()}`,
            text: `🔄 **CONTEXT SWITCHED**
            
Target: **${job?.modelNumber || job?.detectedProduct || 'Unknown Unit'}**
Fault: "${job?.engineerNotes || 'None'}"`,
            sender: 'oscar',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, switchMsg]);
        setChatHistory([]); // Reset LLM history on context switch
    }, [job?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        const userText = input;
        setInput('');

        // 1. User Message
        const userMsg: Message = {
            id: Date.now().toString(),
            text: userText,
            sender: 'user',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        // 2. Call Service
        try {
            const result = await chatWithOscar(userText, chatHistory, job || {}, accessToken);

            const oscarMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: result.text,
                sender: 'oscar',
                timestamp: new Date(),
                sources: result.sources
            };

            setMessages(prev => [...prev, oscarMsg]);

            // Update History
            setChatHistory(prev => [
                ...prev,
                { role: 'user', parts: [{ text: userText }] },
                { role: 'model', parts: [{ text: result.text }] }
            ]);

        } catch (err) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: "I'm having trouble connecting to the network right now.",
                sender: 'oscar',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col"
            >
                {/* HEADER */}
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg">
                    <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md border border-white/20">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black tracking-wide uppercase">OSCAR | RAG</h2>
                                <p className="text-xs opacity-80 font-mono">
                                    Knowledge Base: {accessToken === "mock-token" ? 'Demo Mode' : accessToken ? 'Active' : 'Offline'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* MESSAGES */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 relative">
                    <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px]"></div>

                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} relative z-10 gap-2`}>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`max-w-[85%] p-4 rounded-2xl shadow-lg border ${msg.sender === 'user'
                                    ? 'bg-white text-slate-900 border-white rounded-br-none'
                                    : 'bg-white/5 border-white/10 text-slate-200 rounded-bl-none'
                                    }`}
                            >
                                <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium markdown-body">
                                    {msg.text}
                                </div>
                                <span className="text-[10px] opacity-40 mt-2 block text-right font-mono">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </motion.div>

                            {/* SOURCE BADGES */}
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
                                    {msg.sources.map((source, idx) => (
                                        <a
                                            key={idx}
                                            href={source.link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`
                                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                                                ${source.type === 'drive'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
                                                }
                                            `}
                                        >
                                            {source.type === 'drive' ? <Database size={12} /> : <Globe size={12} />}
                                            {source.name.substring(0, 25)}{source.name.length > 25 ? '...' : ''}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75" />
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* INPUT */}
                <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
                    <form onSubmit={handleSend} className="relative group">
                        <div className="absolute -inset-0.5 rounded-xl blur opacity-20 transition duration-500 bg-indigo-500 group-hover:opacity-40"></div>

                        <div className="relative flex items-center bg-slate-900 rounded-xl border border-white/10 overflow-hidden">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask Oscar..."
                                className="flex-1 bg-transparent px-4 py-4 text-white placeholder:text-slate-600 focus:outline-none font-medium"
                                autoFocus
                            />
                            <button type="submit" disabled={!input.trim()} className="p-4 hover:bg-white/5 text-slate-400">
                                <Send size={20} />
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

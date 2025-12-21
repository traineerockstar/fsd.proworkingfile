import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PrivacyContextType {
    isPrivacyEnabled: boolean;
    togglePrivacy: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const PrivacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isPrivacyEnabled, setIsPrivacyEnabled] = useState(() => {
        const saved = localStorage.getItem('fsd_privacy_mode');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('fsd_privacy_mode', String(isPrivacyEnabled));
    }, [isPrivacyEnabled]);

    const togglePrivacy = () => {
        setIsPrivacyEnabled(prev => !prev);
    };

    return (
        <PrivacyContext.Provider value={{ isPrivacyEnabled, togglePrivacy }}>
            {children}
        </PrivacyContext.Provider>
    );
};

export const usePrivacy = () => {
    const context = useContext(PrivacyContext);
    if (context === undefined) {
        throw new Error('usePrivacy must be used within a PrivacyProvider');
    }
    return context;
};

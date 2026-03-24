'use client';

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'error' | 'success' | 'info';

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    toast: (type: ToastType, message: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx.toast;
}

// ─── Styles per type ──────────────────────────────────────────────────────────

const STYLES: Record<ToastType, { bg: string; iconBg: string; iconColor: string; icon: string }> = {
    error:   { bg: '', iconBg: 'bg-red-50',   iconColor: 'text-red-500',   icon: '✕' },
    success: { bg: '', iconBg: 'bg-green-50', iconColor: 'text-green-600', icon: '✓' },
    info:    { bg: '', iconBg: 'bg-blue-50',  iconColor: 'text-blue-500',  icon: 'ℹ' },
};

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 5000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    const { iconBg, iconColor, icon } = STYLES[item.type];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex items-center gap-3 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.10)] border border-black/6 px-4 py-3 max-w-sm w-full cursor-pointer select-none"
            onClick={onDismiss}
        >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${iconBg} ${iconColor}`}>{icon}</span>
            <p className="text-sm font-semibold text-[var(--color-brand-navy)] flex-1 leading-5">{item.message}</p>
        </motion.div>
    );
}

// ─── Provider + container ─────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counterRef = useRef(0);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = useCallback((type: ToastType, message: string) => {
        const id = `toast-${++counterRef.current}`;
        setToasts(prev => [...prev, { id, type, message }]);
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            {/* Toast container — fixed top-right */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence mode="popLayout">
                    {toasts.map(item => (
                        <div key={item.id} className="pointer-events-auto">
                            <ToastItem item={item} onDismiss={() => dismiss(item.id)} />
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

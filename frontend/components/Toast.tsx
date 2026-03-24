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

const STYLES: Record<ToastType, { border: string; icon: string }> = {
    error:   { border: 'border-l-4 border-l-red-500',   icon: '✕' },
    success: { border: 'border-l-4 border-l-green-500', icon: '✓' },
    info:    { border: 'border-l-4 border-l-blue-500',  icon: 'ℹ' },
};

const ICON_COLOR: Record<ToastType, string> = {
    error:   'text-red-500',
    success: 'text-green-500',
    info:    'text-blue-500',
};

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 5000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    const { border, icon } = STYLES[item.type];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`flex items-start gap-3 bg-white ${border} rounded-2xl shadow-lg p-4 max-w-sm w-full cursor-pointer select-none border border-black/5`}
            onClick={onDismiss}
        >
            <span className={`font-black text-base mt-0.5 ${ICON_COLOR[item.type]}`}>{icon}</span>
            <p className="text-sm font-semibold text-gray-800 flex-1">{item.message}</p>
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

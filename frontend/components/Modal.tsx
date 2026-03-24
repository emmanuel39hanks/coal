'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseCircle } from 'iconsax-reactjs';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    maxWidth?: string;
}

export default function Modal({ isOpen, onClose, children, title, maxWidth = 'max-w-md' }: ModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`relative w-full ${maxWidth} bg-white rounded-[40px] shadow-2xl flex flex-col max-h-[90vh]`}
                    >
                        {/* Sticky header */}
                        <div className="flex items-start justify-between px-8 pt-8 shrink-0">
                            {title ? (
                                <h2 className="text-2xl font-black text-[var(--color-brand-navy)]">{title}</h2>
                            ) : <div />}
                            <button
                                onClick={onClose}
                                className="ml-4 shrink-0 text-gray-400 hover:text-black transition-colors bg-gray-50 p-2 rounded-full hover:bg-gray-100"
                            >
                                <CloseCircle size={24} variant="Bold" />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className="overflow-y-auto px-8 pb-8 pt-6 flex-1">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}

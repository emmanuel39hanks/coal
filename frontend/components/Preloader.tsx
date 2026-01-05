'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function Preloader() {
    const [complete, setComplete] = useState(false);

    useEffect(() => {
        // Shorter display time for better UX, but long enough to see animation
        const timer = setTimeout(() => {
            setComplete(true);
        }, 2800);

        return () => clearTimeout(timer);
    }, []);

    if (complete) return null;

    const sentence = "coal";
    const letters = sentence.split("");

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.3,
            },
        },
        exit: {
            opacity: 0,
            y: -100,
            transition: {
                duration: 0.8,
                ease: [0.76, 0, 0.24, 1]
            }
        }
    };

    const child = {
        hidden: {
            y: 200,
            opacity: 0,
            rotate: 10
        },
        show: {
            y: 0,
            opacity: 1,
            rotate: 0,
            transition: {
                duration: 1.2,
                ease: [0.25, 0.4, 0.25, 1], // Custom cubic bezier for "fancy" smooth feel
            },
        },
    };

    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--color-bg-base)] overflow-hidden"
            initial="hidden"
            animate="show"
            exit="exit"
            onAnimationComplete={() => {
                // Optional: could manually trigger completion here too if driven by animation duration
            }}
        >
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="flex overflow-hidden relative"
            >
                {letters.map((letter, index) => (
                    <motion.span
                        key={index}
                        variants={child}
                        className="text-[15vw] md:text-[12rem] font-black tracking-tighter text-[var(--color-brand-navy)] inline-block origin-bottom-left"
                    >
                        {letter}
                    </motion.span>
                ))}
            </motion.div>
        </motion.div>
    );
}

'use client';

import { useState, useRef } from 'react';
import { Copy, TickCircle } from 'iconsax-reactjs';
import { Highlight, themes } from 'prism-react-renderer';

export default function CodeBlock({ children, className }: any) {
    const [copied, setCopied] = useState(false);

    // MDX usually passes the code as a string child of the `code` element
    // But since we are wrapping `pre`, the `children` is likely the `code` element itself.
    // We need to extract the text and language.

    // MDX 3 sometimes passes children slightly differently depending on the structure.
    // We need to robustly extract the text content and the language class name.

    let code = '';
    let language = 'text';

    const extractDetails = (child: any): { code: string, language: string } => {
        if (typeof child === 'string') {
            return { code: child, language: '' };
        }

        if (child && typeof child === 'object') {
            let foundLang = '';
            let foundCode = '';

            if (child.props && child.props.className && child.props.className.includes('language-')) {
                foundLang = child.props.className.replace('language-', '');
            }

            if (child.props && child.props.children) {
                const result = extractDetails(child.props.children);
                foundCode = result.code;
                if (!foundLang && result.language) {
                    foundLang = result.language;
                }
            }

            return { code: foundCode, language: foundLang };
        }
        return { code: '', language: '' }
    }

    // Attempt standard extraction first (pre > code)
    if (children && children.props && children.props.className && children.props.className.includes('language-')) {
        code = children.props.children;
        language = children.props.className.replace('language-', '');
    } else {
        const details = extractDetails(children);
        if (details.code) {
            code = details.code;
            if (details.language) language = details.language;
        }
    }

    // Default fallback if extracting from simple children
    if (!code && typeof children === 'string') {
        code = children;
    }

    // Check if language was passed directly to the component via className
    if ((!language || language === 'text') && className && className.includes('language-')) {
        language = className.replace('language-', '');
    }

    // Normalize language
    language = language.toLowerCase();

    // Clean up trailing newlines
    code = (code || '').trim();

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group my-8 rounded-[20px] overflow-hidden border border-black/5 shadow-xl bg-[#1e1e1e]">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 h-11 bg-[#2d2d2d] flex items-center justify-between px-4 select-none z-10 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10"></div>
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10"></div>
                    </div>
                    <span className="text-[11px] font-bold text-gray-500 ml-3 uppercase tracking-wider">{language}</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    {copied ? (
                        <>
                            <TickCircle size={14} variant="Bold" className="text-green-500" />
                            <span className="text-green-500">Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy size={14} />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code Body */}
            <Highlight
                theme={themes.vsDark}
                code={code}
                language={language}
            >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                        className="pt-16 pb-6 px-6 overflow-x-auto text-[13px] leading-relaxed font-mono"
                        style={{ ...style, backgroundColor: 'transparent' }} // Force transparent to use parent bg
                    >
                        {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line })}>
                                <span className="inline-block w-8 select-none text-gray-700 text-xs text-right pr-4 opacity-0">{i + 1}</span>
                                {line.map((token, key) => (
                                    <span key={key} {...getTokenProps({ token })} />
                                ))}
                            </div>
                        ))}
                    </pre>
                )}
            </Highlight>
        </div>
    );
}

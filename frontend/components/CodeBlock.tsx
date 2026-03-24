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
        <div className="not-prose my-8 overflow-hidden rounded-[24px] border border-black/8 bg-[#1f1f1f] shadow-[0_16px_36px_rgba(15,23,42,0.12)]">
            {/* Header */}
            <div className="flex h-12 items-center justify-between border-b border-white/6 bg-[#2b2b2b] px-4 select-none">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10"></div>
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10"></div>
                    </div>
                    <span className="ml-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{language}</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
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
                        className="m-0 overflow-x-auto bg-transparent px-6 py-5 text-[13px] leading-7 font-mono shadow-none"
                        style={{ ...style, backgroundColor: 'transparent' }}
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

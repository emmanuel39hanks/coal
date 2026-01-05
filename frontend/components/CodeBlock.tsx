'use client';

export default function CodeBlock() {
    return (
        <div className="w-full max-w-lg mx-auto bg-[#1e1e1e] rounded-3xl overflow-hidden border border-white/10">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                <span className="ml-2 text-xs text-white/40 font-mono">POST /api/checkout</span>
            </div>
            <div className="p-6 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed">
                    <code className="text-[#a9b7c6]">
                        <span className="text-[#cc7832]">{"{"}</span>
                        {"\n  "}<span className="text-[#9876aa]">"description"</span>: <span className="text-[#6a8759]">"Pro Membership"</span>,
                        {"\n  "}<span className="text-[#9876aa]">"amount"</span>: <span className="text-[#6897bb]">50.00</span>,
                        {"\n  "}<span className="text-[#9876aa]">"currency"</span>: <span className="text-[#6a8759]">"MNEE"</span>,
                        {"\n  "}<span className="text-[#9876aa]">"splits"</span>: <span className="text-[#cc7832]">[</span>
                        {"\n    "}<span className="text-[#cc7832]">{"{"}</span> <span className="text-[#9876aa]">"wallet"</span>: <span className="text-[#6a8759]">"0xMerchant"</span>, <span className="text-[#9876aa]">"percent"</span>: <span className="text-[#6897bb]">95</span> <span className="text-[#cc7832]">{"}"}</span>,
                        {"\n    "}<span className="text-[#cc7832]">{"{"}</span> <span className="text-[#9876aa]">"wallet"</span>: <span className="text-[#6a8759]">"0xPlatform"</span>, <span className="text-[#9876aa]">"percent"</span>: <span className="text-[#6897bb]">5</span> <span className="text-[#cc7832]">{"}"}</span>
                        {"\n  "}<span className="text-[#cc7832]">]</span>
                        {"\n"}<span className="text-[#cc7832]">{"}"}</span>
                    </code>
                </pre>
            </div>
        </div>
    );
}

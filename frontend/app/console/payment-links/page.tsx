'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Add, Copy, TickCircle, Global, Money, Box, SearchNormal1, Trash } from 'iconsax-reactjs';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { useSearchParams } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PaymentLinksPage() {
    const { data, error, isLoading } = useSWR('/api/console/links', fetcher);
    const { data: productsData } = useSWR('/api/console/products', fetcher);

    const searchParams = useSearchParams();
    const [isCreateOpen, setIsCreateOpen] = useState(searchParams.get('new') === 'true');

    // Form State
    const [linkType, setLinkType] = useState<'product' | 'flexible'>('product');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [customSlug, setCustomSlug] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    // New Fields for Flexible Links
    const [customTitle, setCustomTitle] = useState('');
    const [customDesc, setCustomDesc] = useState('');

    // Copy State
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    const handleCreate = async () => {
        setCreateLoading(true);
        try {
            const body: any = { slug: customSlug || undefined };
            if (linkType === 'product') {
                body.productId = selectedProduct;
            } else {
                body.title = customTitle;
                body.description = customDesc;
            }

            const res = await fetch('/api/console/links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                mutate('/api/console/links');
                setIsCreateOpen(false);
                setSelectedProduct('');
                setCustomSlug('');
                setCustomTitle('');
                setCustomDesc('');
                setLinkType('product');
            } else {
                alert('Failed to create link (Slug might be taken)');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this link?')) return;
        try {
            const res = await fetch(`/api/console/links/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                mutate('/api/console/links');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const links = data?.links || [];
    const products = productsData?.products || [];

    const filteredLinks = links.filter((link: any) =>
        link.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Payment Links</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Shareable checkout pages.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-black text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                    >
                        <Add size={18} variant="Linear" />
                        New Link
                    </button>
                </div>
            </motion.div>

            {/* Search */}
            <div className="relative">
                <SearchNormal1 size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search links..."
                    className="w-full pl-12 pr-4 h-12 bg-white rounded-2xl border-2 border-black/5 focus:border-[var(--color-brand-orange)] outline-none font-medium transition-colors"
                />
            </div>

            {/* Table View */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[32px] border-2 border-black/5 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-gray-400">Loading links...</td>
                                </tr>
                            ) : filteredLinks.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-gray-400">No links found.</td>
                                </tr>
                            ) : filteredLinks.map((link: any) => (
                                <tr key={link.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            {link.productImage ? (
                                                <img src={link.productImage} alt={link.productName} className="w-10 h-10 rounded-xl object-cover bg-gray-100" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                                    <Global size={20} variant="Bold" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-bold text-[var(--color-brand-navy)]">{link.productName}</div>
                                                <Link href={link.url} target="_blank" className="text-xs text-gray-400 hover:text-blue-500 hover:underline flex items-center gap-1">
                                                    /{link.slug}
                                                </Link>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        {link.productName === 'Custom Amount' || link.price === 'Flexible' ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
                                                <Money size={14} variant="Bold" /> Flexible
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">
                                                <Box size={14} variant="Bold" /> Product
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 font-medium text-[var(--color-brand-navy)]">
                                        {link.price === 'Flexible' ? 'Any Amount' : `${link.price} MNEE`}
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`inline-flex w-2 h-2 rounded-full ${link.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    </td>
                                    <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => copyToClipboard(link.url, link.id)}
                                            className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-[var(--color-brand-navy)] hover:shadow-sm"
                                            title="Copy Link"
                                        >
                                            <AnimatePresence mode="wait">
                                                {copiedId === link.id ? (
                                                    <motion.div
                                                        key="check"
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        exit={{ scale: 0 }}
                                                        className="text-green-500"
                                                    >
                                                        <TickCircle size={20} variant="Bold" />
                                                    </motion.div>
                                                ) : (
                                                    <motion.div
                                                        key="copy"
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        exit={{ scale: 0 }}
                                                    >
                                                        <Copy size={20} variant="Linear" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(link.id)}
                                            className="p-2 hover:bg-red-50 rounded-xl transition-all text-gray-400 hover:text-red-500"
                                            title="Delete Link"
                                        >
                                            <div className="group-hover:text-red-500">
                                                <Trash size={20} variant="Linear" />
                                            </div>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Create Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Create Payment Link"
                maxWidth="max-w-lg"
            >
                <div className="space-y-6">
                    {/* Link Type Selector */}
                    <div className="flex p-1 bg-gray-100 rounded-xl">
                        <button
                            onClick={() => setLinkType('product')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${linkType === 'product' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Sell a Product
                        </button>
                        <button
                            onClick={() => setLinkType('flexible')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${linkType === 'flexible' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Flexible Amount
                        </button>
                    </div>

                    {linkType === 'product' && (
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-[var(--color-brand-navy)] pl-1">Select Product</label>
                            <select
                                value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium appearance-none"
                            >
                                <option value="">Select a product...</option>
                                {products.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.price} MNEE)</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {linkType === 'flexible' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="p-4 rounded-2xl border border-indigo-100/50 text-indigo-900 text-sm font-medium flex items-start gap-3">
                                <div className="p-2 bg-white rounded-lg text-black-600">
                                    <Money size={18} variant="Bold" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-indigo-950 mb-1">Flexible Amount</p>
                                    <p className="leading-relaxed opacity-80">
                                        Perfect for donations, tips, or "pay what you want" products. Clients can enter any amount they wish.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-[var(--color-brand-navy)] pl-1">Link Title</label>
                                <input
                                    value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                                    placeholder="e.g. Buy me a coffee"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-[var(--color-brand-navy)] pl-1">Description (Optional)</label>
                                <textarea
                                    value={customDesc} onChange={e => setCustomDesc(e.target.value)}
                                    className="w-full h-24 p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium resize-none"
                                    placeholder="Thanks for your support!"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-[var(--color-brand-navy)] pl-1">Custom Slug (Optional)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">/pay/</span>
                            <input
                                value={customSlug} onChange={e => setCustomSlug(e.target.value)}
                                className="w-full h-12 pl-14 pr-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                                placeholder="my-cool-link"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={createLoading}
                        className="w-full h-14 bg-black text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                    >
                        {createLoading ? 'Creating...' : 'Create Link'}
                    </button>
                </div>
            </Modal>
        </div>
    );
}

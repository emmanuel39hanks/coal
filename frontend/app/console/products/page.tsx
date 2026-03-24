'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Add, SearchNormal1, Box, Trash, Edit2 } from 'iconsax-reactjs';
import useSWR, { mutate } from 'swr';
import { UploadButton } from '@/utils/uploadthing';
import Modal from '@/components/Modal';
import { useApi } from '@/lib/api';
import { ProductCardSkeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/api-errors';
import { getSettlementToken } from '@/lib/chain';

import { useSearchParams } from 'next/navigation';

export default function ProductsPage() {
    const { fetcher, request: apiRequest } = useApi();
    const toast = useToast();
    const { data, error, isLoading } = useSWR('/api/console/products', fetcher);
    const searchParams = useSearchParams();
    const [isCreateOpen, setIsCreateOpen] = useState(searchParams.get('new') === 'true');
    const [createLoading, setCreateLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [image, setImage] = useState('');
    const [billingType, setBillingType] = useState<'one_time' | 'subscription'>('one_time');
    const [billingInterval, setBillingInterval] = useState<'day' | 'week' | 'month' | 'year'>('month');
    const [billingIntervalCount, setBillingIntervalCount] = useState('1');
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const settlementSymbol = getSettlementToken().symbol;

    const handleOpenCreate = () => {
        setEditingProduct(null);
        setName(''); setDescription(''); setPrice(''); setImage('');
        setBillingType('one_time');
        setBillingInterval('month');
        setBillingIntervalCount('1');
        setIsCreateOpen(true);
    };

    const handleOpenEdit = (product: any) => {
        setEditingProduct(product);
        setName(product.name);
        setDescription(product.description || '');
        setPrice(product.price);
        setImage(product.image || '');
        setBillingType(product.billingType || 'one_time');
        setBillingInterval(product.billingInterval || 'month');
        setBillingIntervalCount(String(product.billingIntervalCount || 1));
        setIsCreateOpen(true);
    };

    const handleSubmit = async () => {
        setCreateLoading(true);
        try {
            const url = editingProduct
                ? `/api/console/products/${editingProduct.id}`
                : '/api/console/products';

            const method = editingProduct ? 'PUT' : 'POST';

            await apiRequest(url, {
                method,
                body: JSON.stringify({
                    name,
                    description,
                    price,
                    image,
                    billingType,
                    billingInterval: billingType === 'subscription' ? billingInterval : undefined,
                    billingIntervalCount: billingType === 'subscription' ? Number(billingIntervalCount || 1) : undefined,
                })
            });

            mutate('/api/console/products'); // Refresh
            toast('success', editingProduct ? 'Product updated' : 'Product created');
            setIsCreateOpen(false);
            setEditingProduct(null);
            // Reset
            setName(''); setDescription(''); setPrice(''); setImage('');
            setBillingType('one_time');
            setBillingInterval('month');
            setBillingIntervalCount('1');
        } catch (e) {
            console.error(e);
            toast('error', getErrorMessage(e, editingProduct ? 'Failed to update product' : 'Failed to create product'));
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await apiRequest(`/api/console/products/${id}`, {
                method: 'DELETE'
            });
            mutate('/api/console/products');
            toast('success', 'Product deleted');
        } catch (e) {
            console.error(e);
            toast('error', getErrorMessage(e, 'Failed to delete product'));
        }
    };

    const products = data?.products || [];

    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Products</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Manage your digital items.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleOpenCreate}
                        className="bg-black text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                    >
                        <Add size={18} variant="Linear" />
                        Create Product
                    </button>
                </div>
            </motion.div>

            {/* List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
                ) : products.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-400">No products yet. Create one!</div>
                ) : (
                    products.map((product: any) => (
                        <div key={product.id} className="bg-white p-6 rounded-[32px] border-2 border-black/5 group hover:border-[var(--color-brand-orange)] transition-all relative">
                            {/* Action Buttons */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button
                                    onClick={() => handleOpenEdit(product)}
                                    className="bg-white text-[var(--color-brand-navy)] p-2 rounded-full hover:bg-gray-50 transition-colors"
                                >
                                    <Edit2 size={16} variant="Bold" />
                                </button>
                                <button
                                    onClick={() => handleDelete(product.id)}
                                    className="bg-white text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                                >
                                    <Trash size={16} variant="Bold" />
                                </button>
                            </div>

                            <div className="h-40 bg-gray-100 rounded-2xl mb-4 overflow-hidden relative">
                                {product.image ? (
                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                        <Box size={32} variant="Bold" />
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-lg text-[var(--color-brand-navy)]">{product.name}</h3>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-bold">{product.price} {settlementSymbol}</span>
                                        {product.billingType === 'subscription' && (
                                            <span className="px-3 py-1 rounded-lg text-sm font-bold bg-[var(--color-brand-orange)]/10 text-[var(--color-brand-orange)]">
                                                Every {product.billingIntervalCount > 1 ? `${product.billingIntervalCount} ` : ''}{product.billingInterval}
                                                {product.billingIntervalCount > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">{product.description}</p>
                            <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-secondary)]">
                                <Box size={14} variant="Bold" className="text-[var(--color-brand-orange)]" />
                                {product.sales} Sales
                            </div>
                        </div>
                    ))
                )}
            </motion.div>

            {/* Create Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title={editingProduct ? "Edit Product" : "New Product"}
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Product Name</label>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            className="w-full h-12 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                            placeholder="Super Cool Item"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Description</label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)}
                            className="w-full h-24 px-6 py-4 rounded-3xl bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium resize-none"
                            placeholder="What are you selling?"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Price ({settlementSymbol})</label>
                        <input
                            type="number" step="0.01"
                            value={price} onChange={e => setPrice(e.target.value)}
                            className="w-full h-12 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Billing Type</label>
                            <select
                                value={billingType}
                                onChange={e => setBillingType(e.target.value as 'one_time' | 'subscription')}
                                className="w-full h-12 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                            >
                                <option value="one_time">One-time</option>
                                <option value="subscription">Recurring subscription</option>
                            </select>
                        </div>

                        {billingType === 'subscription' && (
                            <div>
                                <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Billing Interval</label>
                                <select
                                    value={billingInterval}
                                    onChange={e => setBillingInterval(e.target.value as 'day' | 'week' | 'month' | 'year')}
                                    className="w-full h-12 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                                >
                                    <option value="day">Daily</option>
                                    <option value="week">Weekly</option>
                                    <option value="month">Monthly</option>
                                    <option value="year">Yearly</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {billingType === 'subscription' && (
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Repeat Every</label>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                value={billingIntervalCount}
                                onChange={e => setBillingIntervalCount(e.target.value)}
                                className="w-full h-12 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                                placeholder="1"
                            />
                            <p className="mt-2 pl-4 text-xs font-medium text-[var(--color-text-secondary)]">
                                Coal will save a billing mandate on first payment and generate renewal checkouts on this cadence.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Image</label>
                        <div className={`border-2 border-dashed ${image ? 'border-transparent p-0' : 'border-gray-200 p-6'} rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-gray-50 transition-colors relative overflow-hidden transition-all duration-300`}>
                            {image ? (
                                <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-gray-100 group">
                                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    <button
                                        onClick={() => setImage('')}
                                        className="absolute top-3 right-3 bg-white hover:bg-red-50 text-gray-500 hover:text-red-500 p-2 rounded-full transition-all scale-90 hover:scale-100"
                                        type="button"
                                    >
                                        <Trash size={18} variant="Bold" />
                                    </button>
                                </div>
                            ) : (
                                <UploadButton
                                    endpoint="imageUploader"
                                    onClientUploadComplete={(res) => {
                                        if (res && res[0]) {
                                            console.log("Upload Complete:", res[0]);
                                            setImage(res[0].url);
                                        }
                                    }}
                                    onUploadError={(error: Error) => {
                                        toast('error', error.message || 'Image upload failed');
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={createLoading}
                        className="w-full h-14 bg-black text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] mt-4"
                    >
                        {createLoading ? (editingProduct ? 'Saving...' : 'Creating...') : (editingProduct ? 'Save Changes' : 'Create Product')}
                    </button>
                </div>
            </Modal>
        </div>
    );
}

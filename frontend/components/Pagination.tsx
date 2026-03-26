'use client';

interface PaginationProps {
    total: number;
    limit: number;
    offset: number;
    onPageChange: (offset: number) => void;
}

export default function Pagination({ total, limit, offset, onPageChange }: PaginationProps) {
    if (total <= limit) return null;

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    const pages: (number | 'ellipsis')[] = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== 'ellipsis') {
            pages.push('ellipsis');
        }
    }

    return (
        <div className="flex items-center justify-between pt-2">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                {offset + 1}&ndash;{Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(Math.max(0, offset - limit))}
                    disabled={currentPage === 1}
                    className="h-9 px-3 rounded-full text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                    Prev
                </button>
                {pages.map((page, i) =>
                    page === 'ellipsis' ? (
                        <span key={`e${i}`} className="px-1 text-gray-400">...</span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange((page - 1) * limit)}
                            className={`h-9 w-9 rounded-full text-sm font-bold transition-all ${
                                page === currentPage
                                    ? 'bg-[var(--color-brand-navy)] text-white'
                                    : 'hover:bg-gray-100 text-[var(--color-text-secondary)]'
                            }`}
                        >
                            {page}
                        </button>
                    ),
                )}
                <button
                    onClick={() => onPageChange(offset + limit)}
                    disabled={currentPage === totalPages}
                    className="h-9 px-3 rounded-full text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

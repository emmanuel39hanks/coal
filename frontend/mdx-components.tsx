import type { MDXComponents } from 'mdx/types'
import CodeBlock from '@/components/CodeBlock'
import {
    Callout,
    CodeGroup,
    EndpointBadge,
    ParamTable,
    ResponseExample,
    Steps,
    Step,
    QuickLinks,
} from '@/components/DocComponents'

export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        ...components,

        // ── Doc components — available in every MDX page without import ──
        Callout,
        CodeGroup,
        EndpointBadge,
        ParamTable,
        ResponseExample,
        Steps,
        Step,
        QuickLinks,

        // ── Styled HTML elements ──────────────────────────────────────────
        table: (props) => (
            <div className="overflow-x-auto my-8 border border-gray-200 rounded-xl bg-white shadow-sm">
                <table className="w-full text-left text-sm" {...props} />
            </div>
        ),
        thead: (props) => (
            <thead className="bg-gray-50 border-b border-gray-100" {...props} />
        ),
        th: (props) => (
            <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs" {...props} />
        ),
        tbody: (props) => (
            <tbody className="divide-y divide-gray-100" {...props} />
        ),
        tr: (props) => (
            <tr className="hover:bg-gray-50/50 transition-colors" {...props} />
        ),
        td: (props) => (
            <td className="px-6 py-4 text-gray-700 font-medium" {...props} />
        ),
        pre: (props) => <CodeBlock {...props} />,
    }
}

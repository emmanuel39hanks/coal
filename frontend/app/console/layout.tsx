import ConsoleSidebar from "@/components/ConsoleSidebar";

export default function ConsoleLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[var(--color-bg-base)]">
            <ConsoleSidebar />
            <main className="md:ml-64 min-h-screen">
                <div className="p-8 md:p-12 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

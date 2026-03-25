'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'coal:workspaceId';

export type Workspace = {
    id: string;          // sub-user id for named workspaces / user.id for default / merchant.id for guests
    workspaceId?: string; // Workspace record id (only for named workspaces)
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    isOwn: boolean;
    isDefault?: boolean;  // true only for the user's primary account workspace
};

type WorkspaceContextValue = {
    activeWorkspaceId: string | null;
    workspaces: Workspace[];
    setWorkspaces: (ws: Workspace[]) => void;
    switchWorkspace: (id: string | null) => void;
    currentWorkspace: Workspace | null;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
    activeWorkspaceId: null,
    workspaces: [],
    setWorkspaces: () => {},
    switchWorkspace: () => {},
    currentWorkspace: null,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

    // Restore from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setActiveWorkspaceId(stored);
        } catch {}
    }, []);

    const switchWorkspace = useCallback((id: string | null) => {
        setActiveWorkspaceId(id);
        try {
            if (id) localStorage.setItem(STORAGE_KEY, id);
            else localStorage.removeItem(STORAGE_KEY);
        } catch {}
        // Reload the page so all SWR caches are cleared with the new workspace context
        window.location.reload();
    }, []);

    const currentWorkspace = workspaces.find(w => w.id === activeWorkspaceId) ??
        workspaces.find(w => w.isDefault) ??
        workspaces.find(w => w.isOwn) ?? null;

    return (
        <WorkspaceContext.Provider value={{ activeWorkspaceId, workspaces, setWorkspaces, switchWorkspace, currentWorkspace }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    return useContext(WorkspaceContext);
}

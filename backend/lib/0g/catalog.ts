import { prisma } from '@/lib/prisma';
import { sha256Hex } from '@/lib/0g/storage';
import type { ZeroGArtifactKind } from '@/lib/0g/types';

export function buildZeroGStreamId(namespace: string, entityId: string) {
    return sha256Hex(`coal:${namespace}:${entityId}`);
}

export async function getLatestArtifact(input: {
    kind: ZeroGArtifactKind;
    localEntityType: string;
    localEntityId: string;
}) {
    return prisma.storedArtifact.findFirst({
        where: {
            kind: input.kind,
            localEntityType: input.localEntityType,
            localEntityId: input.localEntityId,
        },
        orderBy: { createdAt: 'desc' },
    });
}

export async function getLatestAnchor(input: {
    kind: string;
    localEntityType: string;
    localEntityId: string;
}) {
    return prisma.chainAnchor.findFirst({
        where: {
            kind: input.kind,
            localEntityType: input.localEntityType,
            localEntityId: input.localEntityId,
        },
        orderBy: { createdAt: 'desc' },
    });
}

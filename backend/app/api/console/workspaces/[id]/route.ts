import { prisma } from '@/lib/prisma';
import { getCallerUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';

// PATCH /api/console/workspaces/:id — rename a named workspace
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCallerUser(request);
        if (!user) return errors.unauthorized();

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const name = (body.name ?? '').trim();
        if (!name) return errors.validation({ name: 'Workspace name is required' });
        if (name.length > 60) return errors.validation({ name: 'Workspace name must be 60 characters or less' });

        const workspace = await prisma.workspace.findFirst({ where: { id, ownerId: user.id } });
        if (!workspace) return errors.notFound('Workspace');

        await prisma.$transaction([
            prisma.workspace.update({ where: { id }, data: { name } }),
            prisma.user.update({ where: { id: workspace.userId }, data: { name } }),
        ]);

        return apiSuccess({ id: workspace.userId, workspaceId: id, name });
    } catch {
        return errors.internal();
    }
}

// DELETE /api/console/workspaces/:id — delete workspace and all its data
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCallerUser(request);
        if (!user) return errors.unauthorized();

        const { id } = await params;

        const workspace = await prisma.workspace.findFirst({ where: { id, ownerId: user.id } });
        if (!workspace) return errors.notFound('Workspace');

        const subUserId = workspace.userId;

        // Cascade delete in FK-safe order.
        // Break circular refs first, then delete leaf-to-root.
        await prisma.checkoutSession.updateMany({ where: { merchantId: subUserId }, data: { subscriptionId: null } });
        await prisma.subscription.updateMany({ where: { merchantId: subUserId }, data: { latestInvoiceId: null } });

        await prisma.fundingWebhookEvent.deleteMany({ where: { merchantId: subUserId } });
        await prisma.fundingIntent.deleteMany({ where: { merchantId: subUserId } });
        await prisma.$executeRaw`DELETE FROM "transaction" WHERE "checkoutId" IN (SELECT id FROM "checkout_session" WHERE "merchantId" = ${subUserId})`;
        await prisma.subscriptionInvoice.deleteMany({ where: { merchantId: subUserId } });
        await prisma.subscription.deleteMany({ where: { merchantId: subUserId } });
        await prisma.billingMandate.deleteMany({ where: { merchantId: subUserId } });
        await prisma.checkoutSession.deleteMany({ where: { merchantId: subUserId } });
        await prisma.teamMember.deleteMany({ where: { merchantId: subUserId } });
        await prisma.webhookEvent.deleteMany({ where: { merchantId: subUserId } });
        await prisma.storedArtifact.deleteMany({ where: { merchantId: subUserId } });
        await prisma.chainAnchor.deleteMany({ where: { merchantId: subUserId } });
        await prisma.computeJob.deleteMany({ where: { merchantId: subUserId } });
        await prisma.apiKey.deleteMany({ where: { merchantId: subUserId } });
        await prisma.$executeRaw`DELETE FROM "paywall_access" WHERE "paywallId" IN (SELECT id FROM "paywall" WHERE "merchantId" = ${subUserId})`;
        await prisma.paywall.deleteMany({ where: { merchantId: subUserId } });
        await prisma.paymentLink.deleteMany({ where: { merchantId: subUserId } });
        await prisma.splitConfig.deleteMany({ where: { merchantId: subUserId } });
        await prisma.product.deleteMany({ where: { merchantId: subUserId } });
        // Workspace record cascades from User deletion
        await prisma.user.delete({ where: { id: subUserId } });

        return apiSuccess({ deleted: true });
    } catch {
        return errors.internal();
    }
}

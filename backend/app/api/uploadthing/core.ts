import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { logger } from '@/lib/logger';

const f = createUploadthing();

const auth = (req: Request) => ({ id: "user1" });

export const ourFileRouter = {
    imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
        .middleware(async ({ req }) => {
            const user = await auth(req);
            if (!user) throw new UploadThingError("Unauthorized");
            return { userId: user.id };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            logger.info({ userId: metadata.userId, url: file.ufsUrl }, 'Upload complete');
            return { uploadedBy: metadata.userId, url: file.ufsUrl };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

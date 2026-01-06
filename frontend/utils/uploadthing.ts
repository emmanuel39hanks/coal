import { generateUploadButton } from "@uploadthing/react";

// Manually defining to avoid cross-project import issues
import type { FileRouter } from "uploadthing/types";

export type OurFileRouter = {
    imageUploader: {
        input: any;
        output: { userId: string; url: string; };
    };
}

export const UploadButton = generateUploadButton<OurFileRouter>();

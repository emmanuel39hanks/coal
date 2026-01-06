
## 7. 📤 UploadThing Setup

Handle file uploads (like avatar images) easily.

### A. Installation
```bash
npm install uploadthing @uploadthing/react
```

### B. Core Config (`app/api/uploadthing/core.ts`)
Define your file routes and permissions.

```typescript
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

// Mock auth function (Replace with Better Auth session check)
const auth = (req: Request) => ({ id: "user1" }); 

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const user = await auth(req);
      if (!user) throw new UploadThingError("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
```

### C. API Route (`app/api/uploadthing/route.ts`)
Serve the upload endpoint.

```typescript
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
```

### D. Environment Variables (`.env`)
Get these from your dashboard at https://uploadthing.com.

```bash
UPLOADTHING_SECRET="sk_live_..."
UPLOADTHING_APP_ID="..."
```

### E. Client Usage
Use the provided components in your UI.

```tsx
import { UploadButton } from "@/utils/uploadthing";

<UploadButton
  endpoint="imageUploader"
  onClientUploadComplete={(res) => {
    console.log("Files: ", res);
    alert("Upload Completed");
  }}
  onUploadError={(error: Error) => {
    alert(`ERROR! ${error.message}`);
  }}
/>
```

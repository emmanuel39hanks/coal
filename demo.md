
# Coal Demo Script

This document outlines the key flows to demonstrate Coal's capabilities.

## 1. Merchant Onboarding (The "Why")
*   **Narrative**: "Setting up crypto payments usually takes days. With Coal, it takes seconds."
*   **Actions**:
    1.  Go to `https://usecoal.xyz/signup`.
    2.  Sign up with Google (Social Login).
    3.  Land immediately on the Console Dashboard.
    4.  Show the empty state (clean slate).

## 2. API Key Generation (The "How")
*   **Narrative**: "Developers need keys. We give them instantly, secure by default."
*   **Actions**:
    1.  Navigate to **Settings** -> **API Keys**.
    2.  Click "Generate Key".
    3.  Copy the Secret Key (show how it's only shown once).
    4.  Explain the difference between `pk_live` (public) and `sk_live` (secret).

## 3. Creating a Product (The "What")
*   **Narrative**: "Let's sell something. How about 'Super Coffee'?"
*   **Actions**:
    1.  Navigate to **Products**.
    2.  Click "New Product".
    3.  Upload an image (shows UploadThing integration).
    4.  Name: "Super Coffee", Price: 5.00 MNEE.
    5.  Save.

## 4. The "No-Code" Flow (Payment Links)
*   **Narrative**: "Don't have a website? No problem."
*   **Actions**:
    1.  Navigate to **Payment Links**.
    2.  Create a link for "Super Coffee".
    3.  Open the link in an Incognito window.
    4.  Show the beautiful Checkout UI.

## 5. The "Pro" Flow (Custom Integration)
*   **Narrative**: "For custom apps, we have a world-class API."
*   **Prerequisite**:
    1.  Create `examples/demo-store/.env.local`.
    2.  Add: `COAL_API_KEY=sk_live_...` (Use a key generated in step 2).
*   **Actions**:
    1.  Switch to the **Demo Store App** (Localhost:3002).
    2.  Show a custom e-commerce frontend.
    3.  Click "Buy Now".
    4.  Redirect to Coal Checkout.
    5.  Complete payment.
    6.  Redirect back to Store "Success" page.
    7.  **Webhook Validation**: Switch to VS Code terminal for `demo-store` to show the "⚡️ Webhook Received!" log.

## 6. Closing the Loop (Console)
*   **Narrative**: "Real-time visibility."
*   **Actions**:
    1.  Go back to **Console Dashboard**.
    2.  Show the new Transaction in the list.
    3.  Show the updated Revenue Graph.

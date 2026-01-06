'use server';

import { redirect } from 'next/navigation';

export async function createCheckout(formData: FormData) {
    const COAL_API_URL = process.env.COAL_API_URL || 'http://localhost:3001/api/checkouts';
    const API_KEY = process.env.COAL_API_KEY;

    if (!API_KEY) {
        throw new Error("Missing COAL_API_KEY");
    }

    // Get all product data from form
    const productId = formData.get('productId') as string;
    const productName = formData.get('productName') as string;
    const productDescription = formData.get('productDescription') as string;
    const productImage = formData.get('productImage') as string;
    const amount = parseFloat(formData.get('amount') as string);

    // Create a checkout session with full product metadata
    const response = await fetch(COAL_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
        },
        body: JSON.stringify({
            amount,
            currency: 'MNEE',
            // Product metadata
            productId,
            productName,
            productDescription,
            productImage,
            // Redirect URLs
            redirectUrl: 'http://localhost:3002/success',
            callbackUrl: 'http://localhost:3002/api/webhook'
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("Coal API Error:", text);
        throw new Error("Failed to create checkout");
    }

    const data = await response.json();

    // Redirect user to the payment page
    if (data.url) {
        redirect(data.url);
    }
}

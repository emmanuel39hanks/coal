
import crypto from 'crypto';

export async function sendWebhook(url: string, payload: any, secret: string) {
    try {
        const timestamp = Date.now().toString();
        const body = JSON.stringify(payload);

        // Create HMAC signature (Coal-Signature)
        // v1=HMAC_SHA256(timestamp + . + body, secret)
        const hmac = crypto.createHmac('sha256', secret);
        const signature = hmac.update(`${timestamp}.${body}`).digest('hex');

        console.log(`[Webhook] Sending to ${url}...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Coal-Signature': `t=${timestamp},v1=${signature}`,
                'User-Agent': 'Coal-Webhook/1.0'
            },
            body
        });

        if (!response.ok) {
            console.error(`[Webhook] Failed: ${response.status} ${response.statusText}`);
            return false;
        }

        console.log(`[Webhook] Success: ${url}`);
        return true;
    } catch (error) {
        console.error(`[Webhook] Error sending to ${url}:`, error);
        return false;
    }
}

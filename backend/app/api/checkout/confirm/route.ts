import { errors } from '@/lib/errors';

export async function POST(request: Request) {
    void request;
    return errors.gone('Use POST /api/pay/confirm instead');
}

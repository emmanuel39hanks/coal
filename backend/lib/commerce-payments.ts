import { createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAIN, RPC_URL } from '@/lib/chain';

// AuthCaptureEscrow on Base mainnet — confirmed address
export const COMMERCE_PAYMENTS_ADDRESS = '0xBdEA0D1bcC5966192B070Fdf62aB4EF5b4420cff' as const;

// Refund/payment collector contracts on Base mainnet
export const OPERATOR_REFUND_COLLECTOR = '0x934907bffd0901b6A21e398B9C53A4A38F02fa5d' as const;
export const PERMIT2_PAYMENT_COLLECTOR = '0x992476B9Ee81d52a5BdA0622C333938D0Af0aB26' as const;

export const COMMERCE_PAYMENTS_ABI = parseAbi([
  // Authorize: locks customer funds in escrow
  'function authorize(address token, uint256 amount, address payer, address payee, bytes32 orderId, uint48 authExpiry, uint256 nonce, bytes calldata signature) external returns (bytes32 authId)',
  // Charge: direct transfer (no escrow)
  'function charge(address token, uint256 amount, address payer, address payee, bytes32 orderId, uint256 nonce, bytes calldata signature) external returns (bytes32 paymentId)',
  // Capture: operator releases escrowed funds to payee
  'function capture(bytes32 authId, uint256 captureAmount, address captureRecipient) external',
  // Void: operator cancels authorization, funds return to payer
  'function void(bytes32 authId) external',
  // Refund: operator returns funds to payer
  'function refund(bytes32 paymentId, uint256 refundAmount, address refundRecipient) external',
  // Events
  'event Authorized(bytes32 indexed authId, address indexed payer, address indexed payee, address token, uint256 amount)',
  'event Captured(bytes32 indexed authId, uint256 captureAmount)',
  'event Voided(bytes32 indexed authId)',
  'event Refunded(bytes32 indexed paymentId, uint256 refundAmount)',
]);

function getOperatorClient() {
  const operatorKey = process.env.COMMERCE_PAYMENTS_OPERATOR_KEY;
  if (!operatorKey) throw new Error('COMMERCE_PAYMENTS_OPERATOR_KEY not set');

  const account = privateKeyToAccount(operatorKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });
}

export async function capturePayment(authId: `0x${string}`, amount: bigint, recipient: `0x${string}`) {
  const client = getOperatorClient();
  return client.writeContract({
    address: COMMERCE_PAYMENTS_ADDRESS,
    abi: COMMERCE_PAYMENTS_ABI,
    functionName: 'capture',
    args: [authId, amount, recipient],
  });
}

export async function voidPayment(authId: `0x${string}`) {
  const client = getOperatorClient();
  return client.writeContract({
    address: COMMERCE_PAYMENTS_ADDRESS,
    abi: COMMERCE_PAYMENTS_ABI,
    functionName: 'void',
    args: [authId],
  });
}

export async function refundPayment(paymentId: `0x${string}`, amount: bigint, recipient: `0x${string}`) {
  const client = getOperatorClient();
  return client.writeContract({
    address: COMMERCE_PAYMENTS_ADDRESS,
    abi: COMMERCE_PAYMENTS_ABI,
    functionName: 'refund',
    args: [paymentId, amount, recipient],
  });
}

import axios from "axios";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

const paystackApi = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    "Content-Type": "application/json",
  },
});

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(params: {
  email: string;
  amount: number;
  reference: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}): Promise<InitializeTransactionResult> {
  const { data } = await paystackApi.post("/transaction/initialize", {
    email: params.email,
    amount: Math.round(params.amount * 100),
    reference: params.reference,
    metadata: params.metadata,
    callback_url: params.callbackUrl,
  });
  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  reference: string;
  metadata: Record<string, unknown>;
}> {
  const { data } = await paystackApi.get(`/transaction/verify/${reference}`);
  return {
    status: data.data.status,
    amount: data.data.amount / 100,
    reference: data.data.reference,
    metadata: data.data.metadata ?? {},
  };
}

export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<string> {
  const { data } = await paystackApi.post("/transferrecipient", {
    type: "nuban",
    name: params.name,
    account_number: params.accountNumber,
    bank_code: params.bankCode,
    currency: "GHS",
  });
  return data.data.recipient_code;
}

export async function initiateTransfer(params: {
  recipientCode: string;
  amount: number;
  reason: string;
  reference: string;
}): Promise<string> {
  const { data } = await paystackApi.post("/transfer", {
    source: "balance",
    recipient: params.recipientCode,
    amount: Math.round(params.amount * 100),
    reason: params.reason,
    reference: params.reference,
    currency: "GHS",
  });
  return data.data.transfer_code;
}

export function generateReference(prefix = "afl"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body)
    .digest("hex");
  return hash === signature;
}

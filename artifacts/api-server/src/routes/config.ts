import { Router } from "express";
import axios from "axios";

const router = Router();

router.get("/config/public", (_req, res) => {
  res.json({
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
  });
});

let banksCache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

router.get("/payments/banks", async (_req, res): Promise<void> => {
  try {
    if (banksCache && Date.now() - banksCache.fetchedAt < CACHE_TTL_MS) {
      res.json(banksCache.data);
      return;
    }

    const { data } = await axios.get("https://api.paystack.co/bank", {
      params: { currency: "GHS", use_cursor: false, perPage: 100 },
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    const banks = (
      data.data as Array<{
        name: string;
        code: string;
        type: string;
        active: boolean;
        supports_transfer: boolean;
      }>
    )
      .filter((b) => b.active && b.supports_transfer)
      .map((b) => ({ name: b.name, code: b.code, type: b.type }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const result = { banks };
    banksCache = { data: result, fetchedAt: Date.now() };
    res.json(result);
  } catch {
    res.status(502).json({ error: "Could not fetch bank list from Paystack" });
  }
});

router.get("/payments/resolve-account", async (req, res): Promise<void> => {
  const { accountNumber, bankCode } = req.query as {
    accountNumber?: string;
    bankCode?: string;
  };

  if (!accountNumber || !bankCode) {
    res.status(400).json({ error: "accountNumber and bankCode are required" });
    return;
  }

  try {
    const { data } = await axios.get(
      "https://api.paystack.co/bank/resolve",
      {
        params: { account_number: accountNumber, bank_code: bankCode },
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    if (data.status && data.data?.account_name) {
      res.json({ accountName: data.data.account_name as string });
    } else {
      res.status(404).json({ error: "Account not found" });
    }
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ?? "Could not resolve account";
    res.status(422).json({ error: msg });
  }
});

export default router;

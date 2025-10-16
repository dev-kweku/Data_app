import axios from "axios";

const BASE_URL = process.env.TPP_BASE_URL || "https://tppgh.myone4all.com/api";
const API_KEY = process.env.TPP_API_KEY!;
const API_SECRET = process.env.TPP_API_SECRET!;
const RETAILER = process.env.TPP_RETAILER || "oliver@myone4all.com";

// ⚡ Helper for consistent headers
const headers = {
  ApiKey: API_KEY,
  ApiSecret: API_SECRET,
};

// 🟦 Airtime Purchase
export async function tppAirtimeTopup(payload: {
  recipient: string;
  amount: number;
  network: number;
  trxn: string;
}) {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/airtime`, {
      headers,
      params: {
        retailer: RETAILER,
        recipient: payload.recipient,
        amount: payload.amount,
        network: payload.network,
        trxn: payload.trxn,
      },
      timeout: 15000,
    });

    // Validate response
    if (!res.data || !res.data["status-code"]) {
      throw new Error("Invalid TPP response");
    }

    return res.data;
  } catch (err: any) {
    console.error("TPP Airtime Topup failed:", err.message || err);
    throw new Error(err.message || "TPP Airtime Topup failed");
  }
}

// 🟩 Data Bundle Purchase
export async function tppDataBundle(payload: {
  recipient: string;
  data_code: string;
  network: number;
  amount: number;
  trxn: string;
}) {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/dataBundle`, {
      headers,
      params: {
        retailer: RETAILER,
        recipient: payload.recipient,
        data_code: payload.data_code,
        network: payload.network,
        amount: payload.amount,
        trxn: payload.trxn,
      },
      timeout: 15000,
    });

    if (!res.data || !res.data["status-code"]) {
      throw new Error("Invalid TPP response");
    }

    return res.data;
  } catch (err: any) {
    console.error("TPP Data Bundle purchase failed:", err.message || err);
    throw new Error(err.message || "TPP Data Bundle purchase failed");
  }
}

// 🟨 Check Transaction Status
export async function tppTransactionStatus(trxn: string) {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/transactionStatus`, {
      headers,
      params: { trxn },
      timeout: 10000,
    });

    return res.data;
  } catch (err: any) {
    console.error("TPP Transaction Status fetch failed:", err.message || err);
    throw new Error(err.message || "Failed to fetch transaction status");
  }
}

// 🟧 Get Data Bundle List
export async function tppGetDataBundleList(network: number) {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/dataBundleList`, {
      headers,
      params: { network },
      timeout: 10000,
    });

    if (!res.data || !Array.isArray(res.data)) {
      throw new Error("Invalid data bundle list response");
    }

    return res.data;
  } catch (err: any) {
    console.error("TPP Data Bundle List fetch failed:", err.message || err);
    throw new Error(err.message || "Failed to fetch data bundle list");
  }
}

// 🟦 Get Balance
export async function getTPPBalance() {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/balance`, {
      headers,
      params: { retailer: RETAILER },
      timeout: 10000,
    });

    if (!res.data) throw new Error("Invalid balance response");

    return res.data;
  } catch (err: any) {
    console.error("TPP Balance fetch failed:", err.message || err);
    throw new Error(err.message || "Failed to fetch TPP balance");
  }
}

// 🟪 Send SMS via TPP
export async function sendTPPSms(recipient: string, message: string, senderId = "DataApp") {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/sms`, {
      headers,
      params: {
        recipient,
        message,
        sender_id: senderId,
        trxn: `sms-${Date.now()}`,
      },
      timeout: 10000,
    });

    if (!res.data) throw new Error("Invalid SMS response");

    return res.data;
  } catch (err: any) {
    console.error("TPP SMS send failed:", err.message || err);
    return null;
  }
}

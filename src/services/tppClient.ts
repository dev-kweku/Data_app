import axios from "axios";

const BASE_URL = process.env.TPP_BASE_URL || "https://tppgh.myone4all.com/api";
const API_KEY = process.env.TPP_API_KEY!;
const API_SECRET = process.env.TPP_API_SECRET!;
const RETAILER = process.env.TPP_RETAILER || "233245000000"; // must be a phone number per docs

// ⚙️ Common headers
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

    if (!res.data?.["status-code"]) {
      throw new Error("Invalid TPP Airtime response");
    }

    return res.data;
  } catch (err: any) {
    console.error("TPP Airtime Topup failed:", err.response?.data || err.message);
    throw new Error(err.message || "TPP Airtime Topup failed");
  }
}

// 🟩 Data Bundle Purchase
export async function tppDataBundle(payload: {
  recipient: string;
  data_code: string;
  network: number;
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
        trxn: payload.trxn,
      },
      timeout: 15000,
    });

    if (!res.data?.["status-code"]) {
      throw new Error("Invalid TPP DataBundle response");
    }

    return res.data;
  } catch (err: any) {
    console.error("TPP Data Bundle purchase failed:", err.response?.data || err.message);
    throw new Error(err.message || "TPP Data Bundle purchase failed");
  }
}

// 🟨 Transaction Status
export async function tppTransactionStatus(trxn: string) {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/transactionStatus`, {
      headers,
      params: { trxn },
      timeout: 10000,
    });
    return res.data;
  } catch (err: any) {
    console.error("TPP Transaction Status fetch failed:", err.response?.data || err.message);
    throw new Error(err.message || "Failed to fetch transaction status");
  }
}

// 🟧 Get Data Bundle List (fixed)
export async function tppGetDataBundleList(network: number) {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/dataBundleList`, {
      headers,
      params: { network },
      timeout: 15000,
    });

    const data = res.data;

    // ✅ TPP returns { bundles: [...], message, status, status-code }
    if (!data || !data.bundles || !Array.isArray(data.bundles)) {
      console.error("Unexpected DataBundleList format:", data);
      throw new Error("Invalid data bundle list response from TPP");
    }

    return data.bundles;
  } catch (err: any) {
    console.error("TPP Data Bundle List fetch failed:", err.response?.data || err.message);
    throw new Error(err.message || "Failed to fetch data bundle list");
  }
}

// 🟦 Get Balance
export async function getTPPBalance() {
  try {
    const res = await axios.get(`${BASE_URL}/TopUpApi/balance`, {
      headers,
      timeout: 10000,
    });

    if (!res.data?.["status-code"]) {
      throw new Error("Invalid balance response");
    }

    return res.data;
  } catch (err: any) {
    console.error("TPP Balance fetch failed:", err.response?.data || err.message);
    throw new Error(err.message || "Failed to fetch TPP balance");
  }
}

// 🟪 Send SMS via TPP
export async function sendTPPSms(
  recipient: string,
  message: string,
  senderId = "DataApp"
) {
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

    if (!res.data?.["status-code"]) {
      throw new Error("Invalid SMS response");
    }

    return res.data;
  } catch (err: any) {
    console.error("TPP SMS send failed:", err.response?.data || err.message);
    throw new Error(err.message || "Failed to send SMS via TPP");
  }
}

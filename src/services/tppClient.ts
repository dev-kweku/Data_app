import axios from "axios";

const BASE_URL = process.env.TPP_BASE_URL || "https://tppgh.myone4all.com/api";

const API_KEY = process.env.TPP_API_KEY || "";
const API_SECRET = process.env.TPP_API_SECRET || "";
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
  const params = {
    retailer: RETAILER,
    recipient: payload.recipient,
    amount: payload.amount,
    network: payload.network,
    trxn: payload.trxn,
  };

  const res = await axios.get(`${BASE_URL}/TopUpApi/airtime`, {
    headers,
    params,
    timeout: 15000,
  });

  return res.data;
}

// 🟩 Data Bundle Purchase
export async function tppDataBundle(payload: {
  recipient: string;
  data_code: string;
  network: number;
  amount:number;
  trxn: string;
}) {
  const params = {
    retailer: RETAILER,
    recipient: payload.recipient,
    data_code: payload.data_code,
    network: payload.network,
    trxn: payload.trxn,
  };

  const res = await axios.get(`${BASE_URL}/TopUpApi/dataBundle`, {
    headers,
    params,
    timeout: 15000,
  });

  return res.data;
}

// 🟨 Check Transaction Status
export async function tppTransactionStatus(trxn: string) {
  const res = await axios.get(`${BASE_URL}/TopUpApi/transactionStatus`, {
    headers,
    params: { trxn },
    timeout: 10000,
  });
  return res.data;
}

// 🟧 Get Data Bundle List (optional helper)
export async function tppGetDataBundleList(network: number) {
  const res = await axios.get(`${BASE_URL}/TopUpApi/dataBundleList`, {
    headers,
    params: { network },
    timeout: 10000,
  });
  return res.data;
}

// get balance
// export async function getTPPBalance(){
//   try{
//     const res=await axios.get(`${BASE_URL}/TopUpApi/balance`,{
//       headers,params:{retailer:RETAILER},timeout:10000,
//     });
//     return res.data;
//   }catch(err:any){
//     throw new Error(`Failed to fetch TPP balance: ${err.message}`)
//   }
// }

export async function getTPPBalance() {
  const url = `${BASE_URL}/TopUpApi/balance`;

  const res = await fetch(url, {
    headers: {
      ApiKey: API_KEY,
      ApiSecret: API_SECRET,
    },
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("TPP balance fetch failed:", res.status, text.slice(0, 200));
    throw new Error(`Failed to fetch TPP balance (${res.status})`);
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error("TPP returned non-JSON response:", text.slice(0, 200));
    throw new Error("TPP returned invalid JSON (maybe an HTML error page?)");
  }
}



export async function sendTPPSms(recipient: string, message: string, senderId = "DataApp") {
  const BASE_URL = process.env.TPP_BASE_URL || "https://tppgh.myone4all.com/api/TopUpApi";
  const API_KEY = process.env.TPP_API_KEY!;
  const API_SECRET = process.env.TPP_API_SECRET!;

  try {
    const res = await axios.get(`${BASE_URL}/sms`, {
      headers: { ApiKey: API_KEY, ApiSecret: API_SECRET },
      params: {
        recipient,
        message,
        sender_id: senderId,
        trxn: `sms-${Date.now()}`,
      },
      timeout: 10000,
    });

    return res.data;
  } catch (err: any) {
    console.error(" SMS send failed:", err.message);
    return null; 
  }
}


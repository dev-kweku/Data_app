"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tppAirtimeTopup = tppAirtimeTopup;
exports.tppDataBundle = tppDataBundle;
exports.tppTransactionStatus = tppTransactionStatus;
exports.tppGetDataBundleList = tppGetDataBundleList;
exports.getTPPBalance = getTPPBalance;
exports.sendTPPSms = sendTPPSms;
const axios_1 = __importDefault(require("axios"));
const BASE_URL = process.env.TPP_BASE_URL || "https://tppgh.myone4all.com/api";
const API_KEY = process.env.TPP_API_KEY || "demo_key";
const API_SECRET = process.env.TPP_API_SECRET || "demo_secret";
const RETAILER = process.env.TPP_RETAILER || "oliver@myone4all.com";
// ⚡ Helper for consistent headers
const headers = {
    ApiKey: API_KEY,
    ApiSecret: API_SECRET,
};
// 🟦 Airtime Purchase
async function tppAirtimeTopup(payload) {
    const params = {
        retailer: RETAILER,
        recipient: payload.recipient,
        amount: payload.amount,
        network: payload.network,
        trxn: payload.trxn,
    };
    const res = await axios_1.default.get(`${BASE_URL}/TopUpApi/airtime`, {
        headers,
        params,
        timeout: 15000,
    });
    return res.data;
}
// 🟩 Data Bundle Purchase
async function tppDataBundle(payload) {
    const params = {
        retailer: RETAILER,
        recipient: payload.recipient,
        data_code: payload.data_code,
        network: payload.network,
        trxn: payload.trxn,
    };
    const res = await axios_1.default.get(`${BASE_URL}/TopUpApi/dataBundle`, {
        headers,
        params,
        timeout: 15000,
    });
    return res.data;
}
// 🟨 Check Transaction Status
async function tppTransactionStatus(trxn) {
    const res = await axios_1.default.get(`${BASE_URL}/TopUpApi/transactionStatus`, {
        headers,
        params: { trxn },
        timeout: 10000,
    });
    return res.data;
}
// 🟧 Get Data Bundle List (optional helper)
async function tppGetDataBundleList(network) {
    const res = await axios_1.default.get(`${BASE_URL}/TopUpApi/dataBundleList`, {
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
async function getTPPBalance() {
    const url = `${BASE_URL}/TopUpApi/balance`;
    const res = await fetch(url, {
        headers: {
            ApiKey: API_SECRET,
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
    }
    catch {
        console.error("TPP returned non-JSON response:", text.slice(0, 200));
        throw new Error("TPP returned invalid JSON (maybe an HTML error page?)");
    }
}
async function sendTPPSms(recipient, message, senderId = "DataApp") {
    const BASE_URL = process.env.TPP_BASE_URL || "https://tppgh.myone4all.com/api/TopUpApi";
    const API_KEY = process.env.TPP_API_KEY;
    const API_SECRET = process.env.TPP_API_SECRET;
    try {
        const res = await axios_1.default.get(`${BASE_URL}/sms`, {
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
    }
    catch (err) {
        console.error(" SMS send failed:", err.message);
        return null;
    }
}
//# sourceMappingURL=tppClient.js.map
import QRCode from "qrcode"


export async function generatePaymentQRCode(data:{
    type:"PAY"|"REQUEST";
    amount:number;
    trxn:string;
    customer:string;
    network?:number;
}){
    const payload=JSON.stringify(data);
    const qr=await QRCode.toDataURL(payload,{width:300})
    return qr;
}
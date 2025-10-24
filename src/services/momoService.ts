import { PrismaClient } from "@prisma/client";
import { AppError } from "../utils/errors";
import { tppCollectMoMo,tppSendMomo } from "./tppClient";


const prisma =new PrismaClient()

export async function collectMomoPayment(
    userId:string,
    customer:string,
    amount:number,
    purpose:string,
    network?:number
){
    const trxn=`MOMO_C2B_${Date.now()}_${userId.slice(0,6)}`;

    try{
        const resp=await tppCollectMoMo({
            customer,
            amount,
            trxn,
            network,
        });
        await prisma.qrTransaction.create({
            data:{
                trxn,
                type:"MOMO_C2B",
                amount,
                customer,
                network,
                qrCodeUrl:"",
                status:resp["status-code"]==="00"?"SUCCESS":"PENDING",
                response:resp,
            }
        })

        return {trxn,resp};

    }catch(error:any){
        console.error("collectMomoPayment error: ",error.message)
        throw new AppError("Failed to collect MoMo payment",502)
    }
}

// verify c2b momo payment

export async function verifyMomoC2BPayment(trxn:string,userId:string){
    const existing=await prisma.qrTransaction.findUnique({where:{trxn}})
    if(!existing) throw new AppError("Transaction not found",404);


    const status=existing.status;
    if(status==="SUCCESS"){
        await prisma.wallet.update({
            where:{userId},
            data:{balance:{increment:existing.amount}}
        });
        return {status:"SUCCESS"};
    }
    throw new AppError("Payment not yet confirmed",400)
}

// Send momo payment (B2C): admin withdrawal or payout

export async function sendMomoPayment(userId:string,
    recipient:string,amount:number,network?:number
){
    const trxn=`MOMO_B2C_${Date.now()}_${userId.slice(0,6)}`

    try{
        const resp=await tppSendMomo({
            recipient,amount,network,trxn
        })

        await prisma.qrTransaction.create({
            data:{
                trxn,type:"MOMO_B2C",amount,network,customer:recipient,qrCodeUrl:"",
                status:resp["status-code"]==="00"?"SUCCESS":"FAILED",
                response:resp,
            }
        });
        if(resp["status-code"]==="00"){
            await prisma.wallet.update({
                where:{userId},data:{balance:{decrement:amount}}
            })
        }

        return {trxn,resp};

    }catch(err:any){
        console.error("sendMomoPayment error :",err.message)
        throw new AppError("Failed to send Momo payment",502)
    }
}
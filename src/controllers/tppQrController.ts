import {Request,Response,NextFunction} from "express"
import { generatePaymentQRCode } from "../utils/qrcode"
import { tppAirtimeTopup } from "../services/tppClient"
import { tppCollectMoMo,tppSendMomo,tppTransactionStatus } from "../services/tppClient"
import {v4 as uuid4} from "uuid"
import { PrismaClient } from "@prisma/client"


const prisma=new PrismaClient()
export class TppQrController{

    // create qrcode
    static async createQr(req:Request,res:Response){
        try{
            const {type,amount,customer,network}=req.body;
            if(!type||!amount||!customer){
                return res.status(400).json({
                    success:false,
                    message:"Missing required fields: type,amount or customer"
                })
            }

            const trxn=`QR-${uuid4()}`;
            const qrData={type,amount,customer,trxn,network};
            const qr=await generatePaymentQRCode(qrData);
            // save to db
            const record=await prisma.qrTransaction.create({
                data:{
                    trxn,type,amount,customer,network,qrCodeUrl:qr,status:"PENDING"
                }
            })
            res.json({
                success:true,
                message:"QR code generated successfully",
                data:record,
            })
        }catch(error:any){
            console.error("QR generation failed ",error.message);
            res.status(500).json({
                success:false,
                message:"Failed to generate QR code"
            })
        }


    }

    static async scanQr(req:Request,res:Response){
        try{
            const {type,amount,customer,trxn,network}=req.body;
            if(!type||!amount||!customer||!trxn){
                return res.status(400).json({
                    success:false,
                    message:"Invalid QR payload"
                })
            }

            let result;
            if(type==="PAY"){
                result=await tppCollectMoMo({
                    customer,amount,trxn,network
                })
            }else if(type==="REQUEST"){
                result=await tppSendMomo({
                    recipient:customer,
                    amount,trxn,network
                })
            }else{
                return res.status(400).json({
                    success:false,
                    message:"Unknown QR type"
                })
            }

            await prisma.qrTransaction.update({
                where:{trxn},data:{
                    status:result?.["status-code"]==="000"?"SUCCESS":"FAILED",
                    response:result,
                }
            })

            res.json({
                success:true,
                message:"Transaction initiated successfully",
                data:result,
            })
        }catch(err:any){
            console.error("QR scan failed :",err.message)
            await prisma.qrTransaction.updateMany({
                where:{trxn:req.body?.trxn},
                data:{status:"FAILED"},
            })
            res.status(500).json({
                success:false,
                message:"Failed to process QR transaction"
            })

        }
    }

    static async checkStatus(req:Request,res:Response){
        try{
            const {trxn}=req.params;
            if(!trxn){
                return res.status(400).json({
                    success:false,
                    message:"Missing transaction ID"
                })
            }
            const statusData=await tppTransactionStatus(trxn)
            const newStatus=statusData?.["status-code"]==="000"?"SUCCESS":statusData?.["status-code"]==="102"?"PENDING":"FAILED";

            const updated=await prisma.qrTransaction.updateMany({
                where:{trxn},
                data:{
                    status:newStatus,
                    response:statusData,
                }
            })

            const status=await tppTransactionStatus(trxn);
            res.json({
                success:true,
                message:"Transaction status fetched successfully",
                status:statusData,
                updated,
            })
        }catch(error:any){
            console.error("QR transaction status check failed :",error.message);
            res.status(500).json({
                success:false,
                message:"Failed to fetch transaction status"
            })
        }
    }
}
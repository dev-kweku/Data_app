import { Request,Response,NextFunction } from "express";
import { PrismaClient,TrxnStatus,TrxnType } from "@prisma/client";
import { AppError } from "../utils/errors";
import { tppAirtimeTopup,tppDataBundle,tppCollectMoMo } from "../services/tppClient";
import { sendTPPSms } from "../services/tppClient";

const prisma=new PrismaClient()

function toNumber(val:any):number{
    if(val==null) return 0;
    if(typeof val==="number") return val;
    if(typeof val.toNumber==="function") return val.toNumber();
    return Number(val);
}

function getStatusCode(apiResp:any):string{
    return apiResp?.["status-code"]??apiResp?.status_code??apiResp?.statusCode??"99"
}

// fund wallet
export async function fundWalletViaMomo(req:Request,res:Response,next:NextFunction){
    try{
        const user=(req as any).user;
        if(!user) throw new AppError("Not authenticated",401);
        const {amount,customer,network}=req.body;
        if(!amount||!customer) throw new AppError("Amount and customer number required",400)
            const trxn=`FUND_${Date.now()}_${user.id.slice(0,6)}`;

        const apiResp=await tppCollectMoMo({
            customer,amount,trxn,network
        })

        const statusCode=getStatusCode(apiResp);
        const success=statusCode==="00";

        await prisma.qrTransaction.create({
            data:{
                trxn,
                type:"MOMO_C2B",
                amount,
                customer,
                network,
                qrCodeUrl:"",
                status:success?"SUCCESS":"PENDING",
                response:apiResp,
                
            }
        })

        if(success){
            await prisma.wallet.upsert({
                where:{userId:user.id},
                update:{balance:{increment:amount}},
                create:{userId:user.id,balance:amount},

            })
        }

        return res.status(success?200:202).json({
            message:success?"Wallet funded successfully":"Awaiting MOMO Confirmation",
            trxn,
            status:success?"Success":"PENDING",
            apiResponse:apiResp,
        })

    }catch(err:any){
        console.error("FundedWalletViaMomo error :",err.message)
        return next(err)

    }
}

// buuy airtime using momo
export async function buyAirtimeViaMomo(req:Request,res:Response,next:NextFunction){
    try{
        const user=(req as any).user;
        if(!user) throw new AppError("Not authenticated",401);

        const {phoneNumber,amount,network,customer}=req.body;
        if(!phoneNumber||!amount||!network||!customer) throw new AppError("phoneNumber,amount,network and customer are required",400)

            const baseAmount=Number(amount);
            if(isNaN(baseAmount)||baseAmount<=0) throw new AppError("Invalid amount ",400)

                const fundTrxn=`AIRTIME_MOMO_${Date.now()}_${user.id.slice(0,6)}`;

                const momoResp=await tppCollectMoMo({
                    customer,amount:baseAmount,
                    trxn:fundTrxn,network,
                })
                const momoStatus=getStatusCode(momoResp)
                if(momoStatus != "00"){
                    throw new AppError("Momo payment failed or pending confirmation",400)
                }

                // proceed to buy airtime
                const trx=await prisma.transaction.create({
                    data:{
                        trxnRef:fundTrxn,
                        userId:user.id,
                        type:TrxnType.AIRTIME,
                        amount:baseAmount,
                        recipient:phoneNumber,
                        networkId:network,
                        status:TrxnStatus.PENDING,
                    }
                })

                const apiResp=await tppAirtimeTopup({
                    network,
                    recipient:phoneNumber,
                    amount:baseAmount,
                    trxn:trx.trxnRef
                })
                const statusCode=getStatusCode(apiResp)
                const success=statusCode==="00";

                await prisma.transaction.update({
                    where:{trxnRef:trx.trxnRef},
                    data:{apiResponse:apiResp,status:success?TrxnStatus.SUCCESS:TrxnStatus.FAILED}
                })

                if(success){
                    try{
                        await sendTPPSms(
                            phoneNumber,
                            `AirTime purchase ${baseAmount} sent to {phoneNumber}`,
                            "DataApp"
                        )
                    }catch(smsErr){
                        console.error("SMS send failed ",smsErr)
                    }
                }
                return res.status(success ? 200:400).json({
                    message:success?"Aitime purchase successful":"Airtime failed",
                    trxnRef:trx.trxnRef,
                    status:success?"SUCCESS":"FAILED",
                    momoResponse:momoResp,
                    apiResponse:apiResp
                })
    }catch(err:any){
        console.error("buyAirtimeViaMomo error :",err);
        return next(err)

    }
}

export async function buyDataViaMomo(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);
    
        const { phoneNumber, planId, amount, network, customer } = req.body;
        if (!phoneNumber || !planId || !amount || !network || !customer)
            throw new AppError("phoneNumber, planId, amount, network, and customer required", 400);
    
        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) throw new AppError("Invalid amount", 400);
    
        const fundTrxn = `DATA_MOMO_${Date.now()}_${user.id.slice(0, 6)}`;
    
        // Step 1 — collect MoMo payment
        const momoResp = await tppCollectMoMo({
            customer,
            amount: baseAmount,
            trxn: fundTrxn,
            network,
        });
    
        const momoStatus = getStatusCode(momoResp);
        if (momoStatus !== "00") {
            throw new AppError("MoMo payment failed or pending confirmation", 400);
        }
    
        // Step 2 — perform data bundle purchase
        const trx = await prisma.transaction.create({
            data: {
            trxnRef: fundTrxn,
            userId: user.id,
            type: TrxnType.DATABUNDLE,
            amount: baseAmount,
            recipient: phoneNumber,
            networkId: network,
            bundlePlanId: planId,
            status: TrxnStatus.PENDING,
            },
        });
    
        const apiResp = await tppDataBundle({
            network,
            recipient: phoneNumber,
            data_code: planId,
            trxn: trx.trxnRef,
        });
    
        const statusCode = getStatusCode(apiResp);
        const success = statusCode === "00";
    
        await prisma.transaction.update({
            where: { trxnRef: trx.trxnRef },
            data: { apiResponse: apiResp, status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED },
        });
    
        if (success) {
            try {
            await sendTPPSms(
                phoneNumber,
                `Data purchase successful! Plan ${planId} activated for ${phoneNumber}.`,
                "DataApp"
            );
            } catch (smsErr) {
            console.error("SMS send failed:", smsErr);
            }
        }
    
        return res.status(success ? 200 : 400).json({
            message: success ? "Data bundle purchase successful" : "Data purchase failed",
            trxnRef: trx.trxnRef,
            status: success ? "SUCCESS" : "FAILED",
            momoResponse: momoResp,
            apiResponse: apiResp,
        });
        } catch (err) {
        console.error("buyDataViaMomo error:", err);
        return next(err);
        }
    }
import cron from "node-cron"
import { PrismaClient ,Role} from "@prisma/client"
import { getTPPBalance, tppDataBundle } from "../services/tppClient"


const prisma=new PrismaClient()

export function startTPPSyncJob(){
    cron.schedule("*/5****",async()=>{
        console.log("Running Tpp balance sync job...")

        try{
            const tpp=await getTPPBalance();
            const tppBalance=Number(tpp.balance||0);

            const admin=await prisma.user.findFirst({where:{role:Role.ADMIN}})
            if(!admin){
                console.warn("No admin found, Skipping sync")
                return
            }

            await prisma.wallet.upsert({
                where:{userId:admin.id},update:{balance:tppBalance},create:{userId:admin.id,balance:tppBalance}
            })

            console.log(`sync admin wallet with Tpp balance : GHS ${tppBalance}`)
        }catch(err:any){
            console.log("Error syncing TPP Balance ",err.message)
        }
    })
}
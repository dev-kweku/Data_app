import { Request, Response, NextFunction } from "express";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { AppError } from "../utils/errors";
import { StringValue } from "ms"; // this is the correct type for expiresIn

const prisma = new PrismaClient();

const JWT_SECRET: string = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as StringValue;

/**
 * Generate JWT
 */
function generateToken(user: { id: string; role: Role }) {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, options);
}


/**
 * Register a new user
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, name, password, role } = req.body;

    if (!email || !name || !password) {
      throw new AppError("Email, name, and password are required", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError("Email already registered", 400);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: role && Object.values(Role).includes(role) ? role : Role.USER,
      },
    });

    // Create wallet for new user
    await prisma.wallet.create({
      data: { userId: user.id, balance: 0 },
    });

    const token = generateToken(user);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Login user and return JWT
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      throw new AppError("Email and password required", 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash)
      throw new AppError("Invalid credentials", 401);

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword)
      throw new AppError("Invalid credentials", 401);

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}


/**
 * Get profile of authenticated user
 */
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as any).user; // populated by auth middleware
    if (!authUser) throw new AppError("Not authenticated", 401);

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!dbUser) throw new AppError("User not found", 404);

    res.json({ user: dbUser });
  } catch (err) {
    next(err);
  }
}


export async function updateProfile(req:Request,res:Response,next:NextFunction){
  try{
    const authUser=(req as any).user;
    if(!authUser) throw new AppError("Not authenticated",401);
    const {name,email,password}=req.body;

    if(!name && !email && !password){
      throw new AppError("No changes provided",400)
    }
    const updateData:any={}
    if(name) updateData.name=name.trim()
      if(email){
        const existing=await prisma.user.findUnique({where:{email}})
        if(existing&&existing.id !==authUser.id){
          throw new AppError("Email already in use",400);
        }
        updateData.email=email.trim().toLowerCase()
      }

    
      if(password){
        updateData.passwordHash=await bcrypt.hash(password,10);
      }

      const updatedUser=await prisma.user.update({
        where:{id:authUser.id},
        data:updateData,
        select:{id:true,name:true,email:true,role:true}
      })

      res.json({
        message:"Profile updated successfully",
        user:updatedUser
      })
  }catch(err:any){
    next(err)

  }
}
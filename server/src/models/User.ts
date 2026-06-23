import { Schema, model, type Model, type Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface UserDoc {
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'manager' | 'employee' | 'accountant';
  companyId?: Types.ObjectId | null;
  refreshTokenHash?: string | null;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserMethods {
  verifyPassword(plain: string): Promise<boolean>;
}

type UserModel = Model<UserDoc, object, UserMethods>;

const userSchema = new Schema<UserDoc, UserModel, UserMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'manager', 'employee', 'accountant'], default: 'admin' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    refreshTokenHash: { type: String, select: false, default: null },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.verifyPassword = async function (this: UserDoc, plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

export const User = model<UserDoc, UserModel>('User', userSchema);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

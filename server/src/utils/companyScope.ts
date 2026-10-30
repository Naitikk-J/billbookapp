import { Types } from 'mongoose';

export function toCompanyObjectId(companyId: string): Types.ObjectId {
  return new Types.ObjectId(companyId);
}

export function companyFilter(companyId: string): { companyId: Types.ObjectId } {
  return { companyId: toCompanyObjectId(companyId) };
}

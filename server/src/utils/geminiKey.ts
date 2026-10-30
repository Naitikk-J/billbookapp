import { Company } from '../models/Company';
import { env } from '../config/env';
import { ApiError } from './ApiError';

export async function resolveGeminiApiKey(companyId: string): Promise<string> {
  const company = await Company.findById(companyId).select('geminiApiKey');
  const apiKey = (company?.geminiApiKey && company.geminiApiKey.trim()) || env.geminiApiKey;
  if (!apiKey) {
    throw ApiError.badRequest(
      'Gemini API key not configured. Add one in Settings → Company, or set GEMINI_API_KEY on the server.'
    );
  }
  return apiKey;
}

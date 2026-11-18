import {NextResponse} from 'next/server';import {z} from 'zod';
import { LIMITS } from './config';
export function jsonError(status:number,code:string,message:string){return NextResponse.json({error:{code,message,requestId:crypto.randomUUID()}},{status})}
const pdfMetadata = {sizeBytes:z.number().int().positive().max(LIMITS.pdfBytes),contentType:z.literal('application/pdf')};
const pdfName = z.string().min(1).max(200).regex(/\.pdf$/i);
export const createJobSchema=z.object({tool:z.literal('merge-pdf'),files:z.array(z.object({name:pdfName,...pdfMetadata}).strict()).min(2).max(LIMITS.maxPdfFiles)}).strict();
export const uploadSchema = z.object({filename:pdfName,...pdfMetadata,position:z.number().int().min(0).max(LIMITS.maxPdfFiles - 1)}).strict();
export const jobIdSchema = z.string().uuid();
export const jobSummaryFields = 'id,tool_slug,status,input_file_count,error_code,created_at,started_at,completed_at,expires_at';
export async function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin)return false;try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}}

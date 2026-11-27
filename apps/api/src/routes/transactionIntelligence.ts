import {Router} from "express";
import multer from "multer";
import {parse} from "csv-parse/sync";
import {z} from "zod";
import {authenticate} from "../middleware/authenticate.js";
import {allowRoles,type TenantRequest} from "../middleware/requireOrganization.js";
import {BankAccount} from "../models/BankAccount.js";
import {StatementImport} from "../models/StatementImport.js";
import {TreasuryTransaction} from "../models/TreasuryTransaction.js";
import {AuditEvent} from "../models/AuditEvent.js";
import { normalizeStatementRow, parseStatementDate } from "../services/transactionValidation.js";

export const transactionIntelligenceRouter=Router();
transactionIntelligenceRouter.use(authenticate);
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1}});
const objectId=z.string().regex(/^[a-f\d]{24}$/i);
const categories=["uncategorized","customer_receipt","supplier_payment","payroll","tax","fees","interest","transfer","other"] as const;
const org=(r:TenantRequest)=>r.tenant!.organizationId;
const actor=(r:TenantRequest)=>r.auth!.userId;
const audit=(r:TenantRequest,action:string,type:string,id:string,metadata:Record<string,unknown>={})=>AuditEvent.create({organizationId:org(r),actorUserId:actor(r),action,resourceType:type,resourceId:id,metadata,ipAddress:r.ip});
const fail=(res:import("express").Response,code:string,message:string,status=400)=>res.status(status).json({error:{code,message}});
transactionIntelligenceRouter.post("/imports",allowRoles("owner","admin","treasury_manager","analyst"),upload.single("file"),async(req,res,next)=>{
 try{
  const r=req as TenantRequest,file=req.file,bankAccountId=String(req.body.bankAccountId??"");
  if(!file){fail(res,"CSV_FILE_REQUIRED","Attach a CSV file using the file field");return;}
  if(!objectId.safeParse(bankAccountId).success){fail(res,"INVALID_BANK_ACCOUNT","A valid bankAccountId is required");return;}
  if(!file.originalname.toLowerCase().endsWith(".csv")){fail(res,"CSV_ONLY","Only CSV statement files are accepted");return;}
  const account=await BankAccount.findOne({_id:bankAccountId,organizationId:org(r),status:"active"}).select("_id currency").lean() as any;
  if(!account){fail(res,"BANK_ACCOUNT_NOT_FOUND","Select an active bank account in this organization",404);return;}
  let records:Record<string,unknown>[];
  try{records=parse(file.buffer,{bom:true,columns:(h:string[])=>h.map(x=>x.trim()),skip_empty_lines:true,trim:true,relax_column_count:false,max_record_size:4096}) as Record<string,unknown>[];}
  catch{fail(res,"CSV_PARSE_ERROR","The CSV could not be parsed; check headers, quoting, and row widths");return;}
  if(records.length>5000){fail(res,"ROW_LIMIT_EXCEEDED","A statement may contain at most 5,000 data rows");return;}
  const headers=records.length?Object.keys(records[0]??{}):[];
  if(!["bookingDate","description","amount"].every(h=>headers.includes(h))){fail(res,"CSV_HEADERS_INVALID","Required headers: bookingDate, description, amount; optional: valueDate, currency, reference, counterparty");return;}
  const valid:Record<string,unknown>[]=[],errors:Record<string,unknown>[]=[];
  records.forEach((row,i)=>{const v=normalizeStatementRow(row,account.currency);if(v.value)valid.push({...v.value,rowNumber:i+2});else errors.push({rowNumber:i+2,messages:v.errors});});
  const batch=await StatementImport.create({organizationId:org(r),bankAccountId,uploadedBy:actor(r),originalFileName:file.originalname.slice(0,180),fileSizeBytes:file.size,status:"validated",totalRows:records.length,validRows:valid.length,invalidRows:errors.length,rows:valid,errors});
  await audit(r,"transactions.statement.validated","statement_import",String(batch._id),{totalRows:records.length,validRows:valid.length,invalidRows:errors.length});
  res.status(201).json({data:{id:batch._id,status:batch.status,totalRows:batch.totalRows,validRows:batch.validRows,invalidRows:batch.invalidRows,errors:batch.errors}});
 }catch(e){next(e);}
});
transactionIntelligenceRouter.get("/imports",allowRoles(),async(req,res,next)=>{
 try{const page=Math.max(1,parseInt(String(req.query.page??"1"),10)||1),limit=Math.min(100,Math.max(1,parseInt(String(req.query.limit??"25"),10)||25)),filter={organizationId:org(req as TenantRequest)};
 const [items,total]=await Promise.all([StatementImport.find(filter).select("-rows -errors").sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),StatementImport.countDocuments(filter)]);
 res.json({data:items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});}catch(e){next(e);}
});
transactionIntelligenceRouter.post("/imports/:id/commit",allowRoles("owner","admin","treasury_manager"),async(req,res,next)=>{
 try{if(!objectId.safeParse(req.params.id).success){fail(res,"INVALID_IMPORT_ID","Invalid import ID");return;}
 const r=req as TenantRequest,batch=await StatementImport.findOne({_id:req.params.id,organizationId:org(r)});
 if(!batch){fail(res,"IMPORT_NOT_FOUND","Statement import not found",404);return;}
 if(batch.status==="completed"){res.json({data:{id:batch._id,status:batch.status,importedRows:batch.importedRows,duplicateRows:batch.duplicateRows,idempotentReplay:true}});return;}
 if(batch.status!=="validated"){fail(res,"IMPORT_NOT_COMMITTABLE","Only validated imports can be committed",409);return;}
 let importedRows=0,duplicateRows=0;
 for(const row of batch.rows as any[]){
  const result=await TreasuryTransaction.updateOne({organizationId:org(r),bankAccountId:batch.bankAccountId,dedupeKey:row.dedupeKey},{$setOnInsert:{organizationId:org(r),bankAccountId:batch.bankAccountId,statementImportId:batch._id,dedupeKey:row.dedupeKey,bookingDate:row.bookingDate,valueDate:row.valueDate,description:row.description,counterparty:row.counterparty,externalReference:row.externalReference,currency:row.currency,amount:row.amount,direction:row.direction,category:"uncategorized",reconciliationStatus:"unmatched"}},{upsert:true});
  if(result.upsertedCount)importedRows++;else duplicateRows++;
 }
 batch.status="completed";batch.importedRows=importedRows;batch.duplicateRows=duplicateRows;batch.completedAt=new Date();await batch.save();
 await audit(r,"transactions.statement.committed","statement_import",String(batch._id),{importedRows,duplicateRows});
 res.json({data:{id:batch._id,status:batch.status,importedRows,duplicateRows}});
 }catch(e){next(e);}
});
transactionIntelligenceRouter.get("/transactions",allowRoles(),async(req,res,next)=>{
 try{const r=req as TenantRequest,page=Math.max(1,parseInt(String(req.query.page??"1"),10)||1),limit=Math.min(100,Math.max(1,parseInt(String(req.query.limit??"25"),10)||25)),filter:Record<string,unknown>={organizationId:org(r)};
 if(req.query.bankAccountId){if(!objectId.safeParse(req.query.bankAccountId).success){fail(res,"INVALID_BANK_ACCOUNT","Invalid bankAccountId");return;}filter.bankAccountId=req.query.bankAccountId;}
 if(req.query.category&&categories.includes(String(req.query.category) as any))filter.category=req.query.category;
 if(req.query.reconciliationStatus&&["matched","unmatched"].includes(String(req.query.reconciliationStatus)))filter.reconciliationStatus=req.query.reconciliationStatus;
 if(req.query.from||req.query.to){const range:Record<string,Date>={};if(req.query.from){const d=parseStatementDate(req.query.from);if(!d){fail(res,"INVALID_DATE","from must use YYYY-MM-DD");return;}range.$gte=d;}if(req.query.to){const d=parseStatementDate(req.query.to);if(!d){fail(res,"INVALID_DATE","to must use YYYY-MM-DD");return;}d.setUTCHours(23,59,59,999);range.$lte=d;}filter.bookingDate=range;}
 const [items,total,summary]=await Promise.all([TreasuryTransaction.find(filter).populate("bankAccountId","accountReference accountName currency").sort({bookingDate:-1,_id:-1}).skip((page-1)*limit).limit(limit).lean(),TreasuryTransaction.countDocuments(filter),TreasuryTransaction.aggregate([{$match:filter},{$group:{_id:{currency:"$currency",direction:"$direction"},total:{$sum:"$amount"},count:{$sum:1}}},{$project:{_id:0,currency:"$_id.currency",direction:"$_id.direction",total:{$toString:"$total"},count:1}}])]);
 res.json({data:items,summary,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
 }catch(e){next(e);}
});
transactionIntelligenceRouter.patch("/transactions/:id/category",allowRoles("owner","admin","treasury_manager","analyst"),async(req,res,next)=>{
 try{if(!objectId.safeParse(req.params.id).success){fail(res,"INVALID_TRANSACTION_ID","Invalid transaction ID");return;}const p=z.object({category:z.enum(categories)}).safeParse(req.body);if(!p.success){fail(res,"INVALID_CATEGORY","Select a supported transaction category");return;}
 const r=req as TenantRequest,item=await TreasuryTransaction.findOneAndUpdate({_id:req.params.id,organizationId:org(r)},{$set:{category:p.data.category}},{new:true,runValidators:true});if(!item){fail(res,"TRANSACTION_NOT_FOUND","Transaction not found",404);return;}
 await audit(r,"transactions.category.updated","treasury_transaction",String(item._id),{category:item.category});res.json({data:item});
 }catch(e){next(e);}
});
transactionIntelligenceRouter.patch("/transactions/:id/reconcile",allowRoles("owner","admin","treasury_manager"),async(req,res,next)=>{
 try{if(!objectId.safeParse(req.params.id).success){fail(res,"INVALID_TRANSACTION_ID","Invalid transaction ID");return;}const p=z.object({matched:z.boolean(),ledgerReference:z.string().trim().min(2).max(160).optional()}).refine(v=>!v.matched||!!v.ledgerReference).safeParse(req.body);if(!p.success){fail(res,"INVALID_RECONCILIATION","Provide matched and, when matching, a ledgerReference");return;}
 const r=req as TenantRequest,update=p.data.matched?{reconciliationStatus:"matched",matchedLedgerReference:p.data.ledgerReference,reconciledBy:actor(r),reconciledAt:new Date()}:{reconciliationStatus:"unmatched",matchedLedgerReference:null,reconciledBy:null,reconciledAt:null};
 const item=await TreasuryTransaction.findOneAndUpdate({_id:req.params.id,organizationId:org(r)},{$set:update},{new:true,runValidators:true});if(!item){fail(res,"TRANSACTION_NOT_FOUND","Transaction not found",404);return;}
 await audit(r,p.data.matched?"transactions.reconciled":"transactions.unmatched","treasury_transaction",String(item._id),{ledgerReference:item.matchedLedgerReference});res.json({data:item});
 }catch(e){next(e);}
});

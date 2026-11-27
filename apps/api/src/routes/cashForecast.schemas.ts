import {z} from "zod";
const id=z.string().regex(/^[a-f\d]{24}$/i);
const date=z.string().datetime({offset:true});
export const cashSnapshotSchema=z.object({
 bankAccountId:id,snapshotDate:date,balance:z.string().regex(/^-?\d{1,15}(?:\.\d{1,4})?$/),
 source:z.enum(["manual","reconciled","bank_statement"]).default("manual"),
 note:z.string().trim().max(500).optional().default("")
}).strict();
export const cashFlowSchema=z.object({
 bankAccountId:id,legalEntityId:id,direction:z.enum(["inflow","outflow"]),
 amount:z.string().regex(/^\d{1,15}(?:\.\d{1,4})?$/),
 dueDate:date,category:z.enum(["customer_receipt","supplier_payment","payroll","tax","debt_service","capital_expenditure","other"]),
 counterparty:z.string().trim().max(180).optional().default(""),
 description:z.string().trim().min(3).max(500),
 confidencePct:z.number().int().min(0).max(100).default(100),
 status:z.enum(["planned","confirmed"]).default("planned"),
 reference:z.string().trim().max(120).optional().default("")
}).strict();
export const cashFlowListSchema=z.object({
 bankAccountId:id.optional(),status:z.enum(["planned","confirmed","cancelled"]).optional(),
 from:date.optional(),to:date.optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25)
}).strict().superRefine((v,ctx)=>{if(v.from&&v.to&&Date.parse(v.to)<Date.parse(v.from))ctx.addIssue({code:"custom",path:["to"],message:"End date must not precede start date."});});
export const cashFlowStatusSchema=z.object({status:z.enum(["confirmed","cancelled"])}).strict();
export const forecastScenarioSchema=z.object({
 name:z.string().trim().min(3).max(120),description:z.string().trim().max(1000).optional().default(""),
 scenarioType:z.enum(["baseline","upside","downside","custom"]),
 horizonDays:z.number().int().min(7).max(365).default(90),
 inflowMultiplier:z.number().min(0).max(3).default(1),
 outflowMultiplier:z.number().min(0).max(3).default(1),
 applyConfidenceWeighting:z.boolean().default(true)
}).strict();
export const forecastRunSchema=z.object({scenarioId:id,bankAccountId:id,asOfDate:date.optional()}).strict();

import Decimal from "decimal.js";
import {Types} from "mongoose";
import {BankAccount} from "../models/BankAccount.js";
import {LegalEntity} from "../models/LegalEntity.js";
import {TreasuryTransaction} from "../models/TreasuryTransaction.js";
import {AuditEvent} from "../models/AuditEvent.js";
import {CashBalanceSnapshot} from "../models/CashBalanceSnapshot.js";
import {CashFlowItem} from "../models/CashFlowItem.js";
import {ForecastScenario} from "../models/ForecastScenario.js";
import {ForecastRun} from "../models/ForecastRun.js";

export class ForecastError extends Error{
 constructor(readonly status:number,readonly code:string,message:string){super(message);this.name="ForecastError";}
}
const fail=(status:number,code:string,message:string):never=>{throw new ForecastError(status,code,message);};
const validId=(value:string)=>Types.ObjectId.isValid(value);
const money=(value:Decimal)=>value.toFixed(4);
const audit=(org:string,actor:string,action:string,type:string,id:string,metadata:Record<string,unknown>={})=>AuditEvent.create({organizationId:org,actorUserId:actor,action,resourceType:type,resourceId:id,metadata});

export async function createCashSnapshot(org:string,actor:string,input:{bankAccountId:string;snapshotDate:string;balance:string;source:"manual"|"reconciled"|"bank_statement";note:string}){
 if(!validId(input.bankAccountId))fail(400,"INVALID_BANK_ACCOUNT","A valid bank account identifier is required.");
 let balance:Decimal;
 try{balance=new Decimal(input.balance);}catch{fail(400,"INVALID_BALANCE","Enter a valid decimal cash balance.");}
 if(!balance!.isFinite()||balance!.decimalPlaces()>4)fail(400,"INVALID_BALANCE","Cash balance must be finite with no more than four decimal places.");
 const snapshotDate=new Date(input.snapshotDate);
 if(!Number.isFinite(snapshotDate.getTime())||snapshotDate>new Date())fail(400,"INVALID_SNAPSHOT_DATE","Snapshot date must be valid and cannot be in the future.");
 const account=await BankAccount.findOne({_id:input.bankAccountId,organizationId:org,status:"active"}).select("_id currency").lean();
 if(!account)fail(404,"BANK_ACCOUNT_NOT_FOUND","An active bank account in this organization was not found.");
 const row=await CashBalanceSnapshot.create({organizationId:org,bankAccountId:input.bankAccountId,snapshotDate,balance:balance!.toFixed(4),currency:account.currency,source:input.source,note:input.note,recordedBy:actor});
 await audit(org,actor,"treasury.cash_snapshot.created","cash_balance_snapshot",String(row._id),{bankAccountId:input.bankAccountId,currency:account.currency,snapshotDate:input.snapshotDate});
 return row;
}

export async function listCashSnapshots(org:string,bankAccountId:string){
 if(!validId(bankAccountId))fail(400,"INVALID_BANK_ACCOUNT","A valid bank account identifier is required.");
 const exists=await BankAccount.exists({_id:bankAccountId,organizationId:org});
 if(!exists)fail(404,"BANK_ACCOUNT_NOT_FOUND","The bank account was not found in this organization.");
 return CashBalanceSnapshot.find({organizationId:org,bankAccountId}).sort({snapshotDate:-1}).limit(50).lean();
}

export async function createCashFlowItem(org:string,actor:string,input:{
 bankAccountId:string;legalEntityId:string;direction:"inflow"|"outflow";amount:string;dueDate:string;category:string;
 counterparty:string;description:string;confidencePct:number;status:"planned"|"confirmed";reference:string
}){
 if(!validId(input.bankAccountId)||!validId(input.legalEntityId))fail(400,"INVALID_CASH_FLOW_REFERENCE","Valid bank account and legal entity identifiers are required.");
 let amount:Decimal;
 try{amount=new Decimal(input.amount);}catch{fail(400,"INVALID_CASH_FLOW_AMOUNT","Enter a valid positive cash flow amount.");}
 if(!amount!.isFinite()||amount!.lte(0)||amount!.decimalPlaces()>4)fail(400,"INVALID_CASH_FLOW_AMOUNT","Cash flow amount must be positive with no more than four decimal places.");
 const dueDate=new Date(input.dueDate);
 if(!Number.isFinite(dueDate.getTime())||dueDate<new Date(new Date().toISOString().slice(0,10)))fail(400,"INVALID_DUE_DATE","Cash flow due date must be today or later.");
 const [account,entity]=await Promise.all([
  BankAccount.findOne({_id:input.bankAccountId,organizationId:org,status:"active"}).select("_id currency legalEntityId").lean(),
  LegalEntity.findOne({_id:input.legalEntityId,organizationId:org,status:"active"}).select("_id functionalCurrency").lean()
 ]);
 if(!account||!entity)fail(404,"CASH_FLOW_REFERENCE_NOT_FOUND","An active bank account and legal entity in this organization are required.");
 if(String(account.legalEntityId)!==input.legalEntityId)fail(400,"LEGAL_ENTITY_MISMATCH","The selected bank account does not belong to the selected legal entity.");
 if(account.currency!==entity.functionalCurrency)fail(400,"CURRENCY_MISMATCH","This forecast requires the bank account and legal entity functional currencies to match.");
 const row=await CashFlowItem.create({...input,organizationId:org,amount:amount!.toFixed(4),currency:account.currency,dueDate,createdBy:actor,updatedBy:actor});
 await audit(org,actor,"treasury.cash_flow.created","cash_flow_item",String(row._id),{direction:row.direction,amount:row.amount.toString(),currency:row.currency,dueDate:row.dueDate});
 return row;
}

export async function listCashFlowItems(org:string,filters:{bankAccountId?:string;status?:string;from?:string;to?:string;page:number;limit:number}){
 const query:Record<string,unknown>={organizationId:org};
 if(filters.bankAccountId){if(!validId(filters.bankAccountId))fail(400,"INVALID_BANK_ACCOUNT","A valid bank account identifier is required.");query.bankAccountId=filters.bankAccountId;}
 if(filters.status)query.status=filters.status;
 if(filters.from||filters.to)query.dueDate={...(filters.from?{$gte:new Date(filters.from)}:{}),...(filters.to?{$lte:new Date(filters.to)}:{})};
 const [items,total]=await Promise.all([
  CashFlowItem.find(query).populate("bankAccountId","accountName accountReference currency").populate("legalEntityId","name code").sort({dueDate:1,_id:1}).skip((filters.page-1)*filters.limit).limit(filters.limit).lean(),
  CashFlowItem.countDocuments(query)
 ]);
 return {items,pagination:{page:filters.page,limit:filters.limit,total,pages:Math.ceil(total/filters.limit)}};
}

export async function updateCashFlowStatus(org:string,actor:string,id:string,status:"confirmed"|"cancelled"){
 if(!validId(id))fail(400,"INVALID_CASH_FLOW_ID","A valid cash flow identifier is required.");
 const item=await CashFlowItem.findOne({_id:id,organizationId:org,status:"planned"});
 if(!item)fail(404,"PLANNED_CASH_FLOW_NOT_FOUND","A planned cash flow item was not found.");
 item.status=status;item.updatedBy=new Types.ObjectId(actor);await item.save();
 await audit(org,actor,"treasury.cash_flow.status_changed","cash_flow_item",id,{status});
 return item;
}

export async function createForecastScenario(org:string,actor:string,input:{
 name:string;description:string;scenarioType:"baseline"|"upside"|"downside"|"custom";horizonDays:number;
 inflowMultiplier:number;outflowMultiplier:number;applyConfidenceWeighting:boolean
}){
 const row=await ForecastScenario.create({...input,organizationId:org,createdBy:actor,updatedBy:actor});
 await audit(org,actor,"treasury.forecast_scenario.created","forecast_scenario",String(row._id),{scenarioType:row.scenarioType,horizonDays:row.horizonDays});
 return row;
}

export async function listForecastScenarios(org:string){
 return ForecastScenario.find({organizationId:org,status:"active"}).sort({createdAt:-1}).limit(100).lean();
}

export async function generateForecast(org:string,actor:string,input:{scenarioId:string;bankAccountId:string;asOfDate?:string}){
 if(!validId(input.scenarioId)||!validId(input.bankAccountId))fail(400,"INVALID_FORECAST_REFERENCE","Valid scenario and bank account identifiers are required.");
 const asOfDate=input.asOfDate?new Date(input.asOfDate):new Date();
 if(!Number.isFinite(asOfDate.getTime())||asOfDate>new Date())fail(400,"INVALID_AS_OF_DATE","Forecast as-of date must be valid and cannot be in the future.");
 const [scenario,account]=await Promise.all([
  ForecastScenario.findOne({_id:input.scenarioId,organizationId:org,status:"active"}).lean(),
  BankAccount.findOne({_id:input.bankAccountId,organizationId:org,status:"active"}).select("_id currency legalEntityId").lean()
 ]);
 if(!scenario||!account)fail(404,"FORECAST_REFERENCE_NOT_FOUND","An active scenario and bank account in this organization are required.");
 const snapshot=await CashBalanceSnapshot.findOne({organizationId:org,bankAccountId:input.bankAccountId,snapshotDate:{$lte:asOfDate}}).sort({snapshotDate:-1}).lean();
 if(!snapshot)fail(409,"CASH_SNAPSHOT_REQUIRED","Record a verified cash balance snapshot on or before the forecast as-of date first.");
 if(snapshot.currency!==account.currency)fail(409,"SNAPSHOT_CURRENCY_MISMATCH","The latest cash snapshot currency does not match the bank account.");
 const transactions=await TreasuryTransaction.find({organizationId:org,bankAccountId:input.bankAccountId,bookingDate:{$gt:snapshot.snapshotDate,$lte:asOfDate}}).select("amount direction").lean();
 let opening=new Decimal(snapshot.balance.toString());
 for(const transaction of transactions){
  const amount=new Decimal(transaction.amount.toString()).abs();
  opening=transaction.direction==="inflow"?opening.plus(amount):opening.minus(amount);
 }
 const endDate=new Date(asOfDate.getTime()+scenario.horizonDays*86_400_000);
 const cashFlows=await CashFlowItem.find({organizationId:org,bankAccountId:input.bankAccountId,status:{$in:["planned","confirmed"]},dueDate:{$gt:asOfDate,$lte:endDate}}).sort({dueDate:1}).lean();
 const byDate=new Map<string,{inflows:Decimal;outflows:Decimal}>();
 for(const flow of cashFlows){
  const key=new Date(flow.dueDate).toISOString().slice(0,10);
  const day=byDate.get(key)??{inflows:new Decimal(0),outflows:new Decimal(0)};
  const confidence=scenario.applyConfidenceWeighting?(flow.status==="confirmed"?100:flow.confidencePct):100;
  const multiplier=flow.direction==="inflow"?scenario.inflowMultiplier:scenario.outflowMultiplier;
  const effective=new Decimal(flow.amount.toString()).mul(confidence).div(100).mul(multiplier);
  if(flow.direction==="inflow")day.inflows=day.inflows.plus(effective);else day.outflows=day.outflows.plus(effective);
  byDate.set(key,day);
 }
 const points:Array<{date:Date;openingBalance:string;inflows:string;outflows:string;closingBalance:string}>=[];
 let running=opening,lowest=opening,shortfallDays=0;
 for(let dayIndex=1;dayIndex<=scenario.horizonDays;dayIndex++){
  const date=new Date(asOfDate);date.setUTCDate(date.getUTCDate()+dayIndex);
  const day=byDate.get(date.toISOString().slice(0,10))??{inflows:new Decimal(0),outflows:new Decimal(0)};
  const dayOpening=running;running=running.plus(day.inflows).minus(day.outflows);
  if(running.lt(lowest))lowest=running;
  if(running.lt(0))shortfallDays++;
  points.push({date,openingBalance:money(dayOpening),inflows:money(day.inflows),outflows:money(day.outflows),closingBalance:money(running)});
 }
 const run=await ForecastRun.create({
  organizationId:org,scenarioId:scenario._id,bankAccountId:input.bankAccountId,currency:account.currency,asOfDate,
  horizonDays:scenario.horizonDays,startingBalance:money(opening),endingBalance:money(running),lowestBalance:money(lowest),shortfallDays,points,
  assumptions:{snapshotId:String(snapshot._id),snapshotDate:snapshot.snapshotDate,transactionCount:transactions.length,cashFlowItemCount:cashFlows.length,inflowMultiplier:scenario.inflowMultiplier,outflowMultiplier:scenario.outflowMultiplier,applyConfidenceWeighting:scenario.applyConfidenceWeighting},
  generatedBy:actor,generatedAt:new Date()
 });
 await audit(org,actor,"treasury.forecast.generated","forecast_run",String(run._id),{scenarioId:String(scenario._id),bankAccountId:input.bankAccountId,shortfallDays,endingBalance:money(running)});
 return run;
}

export async function listForecastRuns(org:string,bankAccountId?:string){
 const query:Record<string,unknown>={organizationId:org};
 if(bankAccountId){if(!validId(bankAccountId))fail(400,"INVALID_BANK_ACCOUNT","A valid bank account identifier is required.");query.bankAccountId=bankAccountId;}
 return ForecastRun.find(query).populate("scenarioId","name scenarioType horizonDays").populate("bankAccountId","accountName accountReference currency").sort({generatedAt:-1}).limit(50).lean();
}

import mongoose,{Schema} from "mongoose";
const schema=new Schema({
 organizationId:{type:Schema.Types.ObjectId,ref:"Organization",required:true,index:true},
 bankAccountId:{type:Schema.Types.ObjectId,ref:"BankAccount",required:true,index:true},
 legalEntityId:{type:Schema.Types.ObjectId,ref:"LegalEntity",required:true,index:true},
 direction:{type:String,enum:["inflow","outflow"],required:true,index:true},
 amount:{type:Schema.Types.Decimal128,required:true},
 currency:{type:String,required:true,uppercase:true,minlength:3,maxlength:3},
 dueDate:{type:Date,required:true,index:true},
 category:{type:String,enum:["customer_receipt","supplier_payment","payroll","tax","debt_service","capital_expenditure","other"],required:true},
 counterparty:{type:String,trim:true,maxlength:180,default:""},
 description:{type:String,required:true,trim:true,maxlength:500},
 confidencePct:{type:Number,min:0,max:100,default:100},
 status:{type:String,enum:["planned","confirmed","cancelled"],default:"planned",index:true},
 reference:{type:String,trim:true,maxlength:120,default:""},
 createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true},
 updatedBy:{type:Schema.Types.ObjectId,ref:"User",required:true}
},{timestamps:true,versionKey:false});
schema.index({organizationId:1,bankAccountId:1,status:1,dueDate:1});
schema.index({organizationId:1,legalEntityId:1,dueDate:1});
export const CashFlowItem=(mongoose.models.CashFlowItem as mongoose.Model<any>|undefined)??mongoose.model<any>("CashFlowItem",schema);

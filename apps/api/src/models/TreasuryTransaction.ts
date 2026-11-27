import mongoose,{Schema} from "mongoose";
const schema=new Schema({
 organizationId:{type:Schema.Types.ObjectId,ref:"Organization",required:true,index:true},
 bankAccountId:{type:Schema.Types.ObjectId,ref:"BankAccount",required:true,index:true},
 statementImportId:{type:Schema.Types.ObjectId,ref:"StatementImport",required:true,index:true},
 dedupeKey:{type:String,required:true},bookingDate:{type:Date,required:true,index:true},valueDate:{type:Date,default:null},
 description:{type:String,required:true,maxlength:500},counterparty:{type:String,default:null,maxlength:180},
 externalReference:{type:String,default:null,maxlength:160},currency:{type:String,required:true,uppercase:true,minlength:3,maxlength:3},
 amount:{type:Schema.Types.Decimal128,required:true},direction:{type:String,enum:["inflow","outflow"],required:true,index:true},
 category:{type:String,enum:["uncategorized","customer_receipt","supplier_payment","payroll","tax","fees","interest","transfer","other"],default:"uncategorized",index:true},
 reconciliationStatus:{type:String,enum:["unmatched","matched"],default:"unmatched",index:true},
 matchedLedgerReference:{type:String,default:null,maxlength:160},reconciledBy:{type:Schema.Types.ObjectId,ref:"User",default:null},reconciledAt:{type:Date,default:null}
},{timestamps:true,versionKey:false});
schema.index({organizationId:1,bankAccountId:1,dedupeKey:1},{unique:true});
schema.index({organizationId:1,bookingDate:-1,bankAccountId:1});
export const TreasuryTransaction=(mongoose.models.TreasuryTransaction as mongoose.Model<any>|undefined)??mongoose.model<any>("TreasuryTransaction",schema);

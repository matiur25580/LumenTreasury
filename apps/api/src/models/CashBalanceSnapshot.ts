import mongoose,{Schema} from "mongoose";
const schema=new Schema({
 organizationId:{type:Schema.Types.ObjectId,ref:"Organization",required:true,index:true},
 bankAccountId:{type:Schema.Types.ObjectId,ref:"BankAccount",required:true,index:true},
 snapshotDate:{type:Date,required:true,index:true},
 balance:{type:Schema.Types.Decimal128,required:true},
 currency:{type:String,required:true,uppercase:true,minlength:3,maxlength:3},
 source:{type:String,enum:["manual","reconciled","bank_statement"],default:"manual"},
 note:{type:String,trim:true,maxlength:500,default:""},
 recordedBy:{type:Schema.Types.ObjectId,ref:"User",required:true}
},{timestamps:true,versionKey:false});
schema.index({organizationId:1,bankAccountId:1,snapshotDate:-1});
export const CashBalanceSnapshot=(mongoose.models.CashBalanceSnapshot as mongoose.Model<any>|undefined)??mongoose.model<any>("CashBalanceSnapshot",schema);

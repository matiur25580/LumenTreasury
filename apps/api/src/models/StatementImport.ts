import mongoose, { Schema } from "mongoose";
const schema = new Schema({
 organizationId:{type:Schema.Types.ObjectId,ref:"Organization",required:true,index:true},
 bankAccountId:{type:Schema.Types.ObjectId,ref:"BankAccount",required:true,index:true},
 uploadedBy:{type:Schema.Types.ObjectId,ref:"User",required:true},
 originalFileName:{type:String,required:true,maxlength:180},
 fileSizeBytes:{type:Number,required:true,min:1,max:2097152},
 status:{type:String,enum:["validated","completed","failed"],default:"validated",index:true},
 totalRows:{type:Number,required:true,min:0,max:5000}, validRows:{type:Number,required:true,min:0,max:5000}, invalidRows:{type:Number,required:true,min:0,max:5000},
 importedRows:{type:Number,default:0,min:0}, duplicateRows:{type:Number,default:0,min:0},
 rows:{type:[Schema.Types.Mixed],default:[]}, errors:{type:[Schema.Types.Mixed],default:[]}, completedAt:{type:Date,default:null}
},{timestamps:true,versionKey:false});
schema.index({organizationId:1,bankAccountId:1,createdAt:-1});
export const StatementImport=(mongoose.models.StatementImport as mongoose.Model<any>|undefined)??mongoose.model<any>("StatementImport",schema);

import mongoose,{Schema} from "mongoose";
const pointSchema=new Schema({
 date:{type:Date,required:true},
 openingBalance:{type:String,required:true},
 inflows:{type:String,required:true},
 outflows:{type:String,required:true},
 closingBalance:{type:String,required:true}
},{_id:false});
const schema=new Schema({
 organizationId:{type:Schema.Types.ObjectId,ref:"Organization",required:true,index:true},
 scenarioId:{type:Schema.Types.ObjectId,ref:"ForecastScenario",required:true,index:true},
 bankAccountId:{type:Schema.Types.ObjectId,ref:"BankAccount",required:true,index:true},
 currency:{type:String,required:true,uppercase:true,minlength:3,maxlength:3},
 asOfDate:{type:Date,required:true},
 horizonDays:{type:Number,required:true,min:7,max:365},
 startingBalance:{type:String,required:true},
 endingBalance:{type:String,required:true},
 lowestBalance:{type:String,required:true},
 shortfallDays:{type:Number,required:true,min:0},
 points:{type:[pointSchema],default:[]},
 assumptions:{type:Schema.Types.Mixed,default:{}},
 generatedBy:{type:Schema.Types.ObjectId,ref:"User",required:true},
 generatedAt:{type:Date,default:Date.now,required:true}
},{timestamps:true,versionKey:false});
schema.index({organizationId:1,bankAccountId:1,generatedAt:-1});
schema.index({organizationId:1,scenarioId:1,generatedAt:-1});
export const ForecastRun=(mongoose.models.ForecastRun as mongoose.Model<any>|undefined)??mongoose.model<any>("ForecastRun",schema);

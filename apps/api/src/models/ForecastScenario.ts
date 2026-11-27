import mongoose,{Schema} from "mongoose";
const schema=new Schema({
 organizationId:{type:Schema.Types.ObjectId,ref:"Organization",required:true,index:true},
 name:{type:String,required:true,trim:true,maxlength:120},
 description:{type:String,trim:true,maxlength:1000,default:""},
 scenarioType:{type:String,enum:["baseline","upside","downside","custom"],default:"custom"},
 horizonDays:{type:Number,required:true,min:7,max:365,default:90},
 inflowMultiplier:{type:Number,required:true,min:0,max:3,default:1},
 outflowMultiplier:{type:Number,required:true,min:0,max:3,default:1},
 applyConfidenceWeighting:{type:Boolean,default:true},
 status:{type:String,enum:["active","archived"],default:"active",index:true},
 createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true},
 updatedBy:{type:Schema.Types.ObjectId,ref:"User",required:true}
},{timestamps:true,versionKey:false});
schema.index({organizationId:1,name:1},{unique:true});
export const ForecastScenario=(mongoose.models.ForecastScenario as mongoose.Model<any>|undefined)??mongoose.model<any>("ForecastScenario",schema);

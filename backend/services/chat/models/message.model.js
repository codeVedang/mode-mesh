import mongoose from "mongoose";

const fileSchema=new mongoose.Schema({
    name:String,
    content:String
},{
    _id:false
})

const artifactSchema=new mongoose.Schema({
    id:Number,
    type:String,
    title:String,
    files:[fileSchema],

},{
    _id:false
})

const deliverableSchema=new mongoose.Schema({
    type:String,
    name:String,
    label:String,
    url:String,
    mimeType:String,
    expiresAt:Date
},{
    _id:false
})

const executionStepSchema=new mongoose.Schema({
    id:String,
    label:String,
    agent:String,
    status:String,
    detail:String
},{
    _id:false
})

const executionSchema=new mongoose.Schema({
    id:String,
    status:String,
    objective:String,
    plan:[String],
    selectedAgent:String,
    startedAt:Number,
    completedAt:Date,
    durationMs:Number,
    requiresApproval:Boolean,
    steps:[executionStepSchema]
},{
    _id:false
})


const messageSchema=new mongoose.Schema({
    conversationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation"
    },
    role:{
        type:String,
        enum:["user","assistant"]
    },
    content:String,
    images:[String],
    artifacts:[artifactSchema],
    deliverables:[deliverableSchema],
    execution:executionSchema

},{
    timestamps:true
})

const Message=mongoose.model("Message",messageSchema)
export default Message

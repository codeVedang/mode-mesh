import { createSlice } from "@reduxjs/toolkit";

const conversationSlice=createSlice({
    name:"conversation",
    initialState:{
      conversations:[],
      selectedConversation:null
    },
    reducers:{
       setConversations:(state,action)=>{
        state.conversations=action.payload
       },
       addConversation:(state,action)=>{
        state.conversations.unshift(action.payload)
       },
        setSelectedConversation:(state,action)=>{
        state.selectedConversation=action.payload
       },

      setConvTitle:(state,action)=>{
           const {title,conversationId}=action.payload
           state.conversations=state.conversations.map((conv)=>(
            conv._id==conversationId?(
             { ...conv,title}
            ):conv
           )) 

           if(state.selectedConversation?._id==conversationId){
               state.selectedConversation={...state.selectedConversation,title}
           }
      },

      touchConversation:(state,action)=>{
           const {conversationId,updatedAt}=action.payload
           const conversationIndex=state.conversations.findIndex((conv)=>conv._id==conversationId)

           if(conversationIndex>=0){
             const [conversation]=state.conversations.splice(conversationIndex,1)
             state.conversations.unshift({...conversation,updatedAt})
           }
      }

    }
   
})

export const {setConversations,addConversation,setSelectedConversation,setConvTitle,touchConversation}=conversationSlice.actions
export default conversationSlice.reducer


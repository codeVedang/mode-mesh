// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider} from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "modemesh-ai.firebaseapp.com",
  projectId: "modemesh-ai",
  storageBucket: "modemesh-ai.firebasestorage.app",
  messagingSenderId: "39856505500",
  appId: "1:39856505500:web:0e72e11371d36b92fd6359",
  measurementId: "G-6WWWSZPMGE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth=getAuth(app)
export const googleProvider=new GoogleAuthProvider()

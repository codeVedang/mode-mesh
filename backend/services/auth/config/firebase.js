import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../serviceAccountKey.json", import.meta.url)),
        "utf8"
      )
    );

export const app = initializeApp({
  credential: cert(serviceAccount),
});

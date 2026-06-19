import mongoose from "mongoose";
import { config } from "../../config.js";
import { ensureSuperAdminSeed } from "./seed.js";

let isConnected = false;

export const connectDatabase = async () => {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(config.mongodbUri, {
      dbName: config.mongodbDbName,
      serverSelectionTimeoutMS: 2000,
    });
    await ensureSuperAdminSeed();
    isConnected = true;
    console.log(`MongoDB connected: ${config.mongodbDbName}`);
    return mongoose.connection;
  } catch (error) {
    if (config.mongodbOptional) {
      console.warn(
        `MongoDB connection skipped: ${error.message}`
      );
      return null;
    }

    throw error;
  }
};

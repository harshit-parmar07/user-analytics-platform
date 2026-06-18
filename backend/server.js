dotenv.config();

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import analyticsRoutes from "./routes/analyticsRoutes.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGO_URI;

const connectDatabase = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connection established successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

connectDatabase();

app.use("/api", analyticsRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

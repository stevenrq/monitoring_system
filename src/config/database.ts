import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Conectado a la base de datos MongoDB");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error de conexión a MongoDB:", error.message);
    } else {
      console.error("Error desconocido de conexión a MongoDB");
    }
    process.exit(1);
  }
};

export default connectDB;

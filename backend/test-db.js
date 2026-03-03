require("dotenv").config();
const mongoose = require("mongoose");

console.log("Attempting to connect to MongoDB...");
console.log("URI:", process.env.MONGO_URI ? "Found" : "Missing");

mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
})
    .then(() => {
        console.log("✅ SUCCESS: Successfully connected to MongoDB Atlas!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ FAILURE: Could not connect to MongoDB.");
        console.error("Error Name:", err.name);
        console.error("Error Message:", err.message);
        if (err.reason) {
            console.error("Reason:", JSON.stringify(err.reason, null, 2));
        }
        process.exit(1);
    });

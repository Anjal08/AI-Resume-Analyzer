const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
console.log("MONGO_URI:", process.env.MONGO_URI ? "DEFINED" : "UNDEFINED");
console.log("MONGO_URI VALUE:", process.env.MONGO_URI);
console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "DEFINED" : "UNDEFINED");

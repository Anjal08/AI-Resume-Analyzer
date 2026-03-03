require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    console.log("🔍 DIAGNOSTIC: Checking API Key Permissions...");
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
        console.log("❌ No API Key found in .env");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(key);
        // We can't easily list models in the JS SDK without the Admin SDK sometimes,
        // but we can try a basic info check or a different approach.

        console.log("---------------------------------");
        console.log("Attempting to list models...");
        // This is a lower-level endpoint check
        console.log("If this fails with 'fetch failed', your internet or Node.js network stack is blocked.");
        console.log("---------------------------------");

        // Let's try to just hit the endpoint with a simple model name that is universal
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("test");
        const response = await result.response;
        console.log("✅ Success! Your API key and network are working.");
        console.log("Response:", response.text());

    } catch (err) {
        console.log("❌ FAILED!");
        console.log("Error Name:", err.name);
        console.log("Error Message:", err.message);

        if (err.message.includes("fetch failed")) {
            console.log("\n🚨 NETWORK BLOCK DETECTED!");
            console.log("Your computer is blocking Node.js from reaching Google.");
            console.log("Try: Disabling Firewall or Proxy, or checking your WiFi.");
        }

        if (err.message.includes("404")) {
            console.log("\n🚩 MODEL NOT FOUND!");
            console.log("Your API key is working, but it doesn't have access to this specific model.");
        }

        if (err.message.includes("403")) {
            console.log("\n🚫 PERMISSION DENIED!");
            console.log("Your API key is restricted. Check your API key settings in Google AI Studio.");
        }
    }
}

listModels();

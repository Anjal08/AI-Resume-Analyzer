require("dotenv").config();
const https = require("https");

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ No API Key found in .env");
    process.exit(1);
}

console.log("-----------------------------------------");
console.log("🔍 DEEP DIAGNOSTIC: Fetching Available Models via REST API");
console.log(`Using Key: ${API_KEY.substring(0, 10)}...`);
console.log("-----------------------------------------");

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

https.get(url, (res) => {
    let data = "";
    res.on("data", (chunk) => data += chunk);
    res.on("end", () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("❌ API Error Report:");
                console.error(`   Status: ${json.error.status}`);
                console.error(`   Message: ${json.error.message}`);
                console.log("\n🚩 This confirms your API key has NO access to Gemini models yet.");
            } else if (json.models) {
                console.log("✅ Success! Found these available models for your key:");
                json.models.forEach(m => {
                    console.log(`   - ${m.name.split("/")[1]}  (${m.displayName})`);
                });
                console.log("\n🚀 COPY ONE OF THESE NAMES and use it!");
            } else {
                console.log("❓ Unexpected Response Format:", data);
            }
        } catch (e) {
            console.error("❌ Failed to parse response:", e.message);
            console.log("Raw Response:", data);
        }
    });
}).on("error", (err) => {
    console.error("❌ Connection Error:", err.message);
});

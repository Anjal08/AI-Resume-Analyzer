require("dotenv").config();
const Groq = require("groq-sdk");

async function testGroq() {
    console.log("🧪 Testing Groq API Key...");
    const key = (process.env.GROQ_API_KEY || "").trim();

    if (!key) {
        console.error("❌ No GROQ_API_KEY found in .env!");
        return;
    }

    console.log(`Using Key: ${key.substring(0, 10)}...`);

    try {
        const groq = new Groq({ apiKey: key });
        console.log("🤖 Sending test message to llama-3.3-70b-versatile...");

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Hello Groq, are you ready to analyze resumes?" }],
            model: "llama-3.3-70b-versatile",
        });

        console.log("✅ SUCCESS!");
        console.log("Groq Response:", chatCompletion.choices[0]?.message?.content);
        console.log("\n------------------------------------------------");
        console.log("🚀 Your backend is now ready to use Groq!");
        console.log("------------------------------------------------");
    } catch (err) {
        console.error("❌ Groq Test Failed!");
        console.error("Error Message:", err.message);
        console.log("\n🚩 Common Fixes:");
        console.log("1. Double check your key at https://console.groq.com/keys");
        console.log("2. Ensure you have run 'npm install groq-sdk'");
    }
}

testGroq();

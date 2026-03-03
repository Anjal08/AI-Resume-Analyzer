const https = require("https");

console.log("-----------------------------------------");
console.log("🌐 STARTING NETWORK DIAGNOSTICS...");
console.log("-----------------------------------------");

const domains = [
    "www.google.com",
    "generativelanguage.googleapis.com"
];

domains.forEach(domain => {
    console.log(`📡 Checking connectivity to: ${domain}...`);
    https.get(`https://${domain}`, (res) => {
        console.log(`✅ ${domain}: Connected (Status: ${res.statusCode})`);
    }).on("error", (e) => {
        console.error(`❌ ${domain}: FAILED!`);
        console.error(`   Error message: ${e.message}`);
        console.error(`   Error code: ${e.code}`);
    });
});

console.log("\n(Check your terminal output in 2 seconds...)\n");

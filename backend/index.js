const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const pdf = require("pdf-parse");
const Groq = require("groq-sdk");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Application } = require("./models");
const fs = require("fs");
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage });
const groq = new Groq({ apiKey: (process.env.GROQ_API_KEY || "").trim() });


const connectWithRetry = () => {
    console.log("🔄 Attempting to connect to MongoDB...");
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error("❌ MONGO_URI is not defined in environment variables!");
        process.exit(1);
    }

    mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
    })
        .then(() => console.log("✅ MongoDB Connected Successfully"))
        .catch(err => {
            console.error("❌ MongoDB Connection Error:", err.message);
            console.log("🔄 Retrying in 5 seconds...");
            setTimeout(connectWithRetry, 5000);
        });
};

connectWithRetry();

// Handle unexpected disconnection
mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected! Attempting to reconnect...');
    connectWithRetry();
});

// --- AUTH MIDDLEWARE ---
const auth = (req, res, next) => {
    const token = req.header("x-auth-token");
    if (!token) return res.status(401).json({ error: "No token, authorization denied" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ error: "Token is not valid" });
    }
};

// --- AUTH ROUTES ---
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ error: "User already exists" });

        user = new User({ name, email, password });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
        });
    } catch (err) {
        console.error("❌ Registration Error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
        });
    } catch (err) {
        console.error("❌ Login Error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

app.post("/api/auth/google", async (req, res) => {
    try {
        const { credential } = req.body;
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { name, email, sub } = ticket.getPayload();

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ name, email, googleId: sub });
            await user.save();
        }

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
        });
    } catch (err) {
        console.error("❌ Google Auth Error:", err);
        res.status(500).json({ error: "Google Authentication failed", details: err.message });
    }
});


// --- PLATFORM ROUTES ---

app.get("/api/health", (req, res) => res.json({ status: "ok", version: "6.0" }));

// Get User Dashboard (History)
app.get("/api/applications", auth, async (req, res) => {
    try {
        const applications = await Application.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(applications);
    } catch (err) {
        console.error("❌ Applications Fetch Error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

app.delete("/api/applications/:id", auth, async (req, res) => {
    try {
        const app = await Application.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!app) return res.status(404).json({ error: "Application not found" });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Delete Error:", err);
        res.status(500).json({ error: "Delete failed" });
    }
});

// AI Interview Roleplay
app.post("/api/chat/interview", auth, async (req, res) => {
    try {
        const { applicationId, message, history } = req.body;
        const appData = await Application.findOne({ _id: applicationId, userId: req.user.id });
        if (!appData) return res.status(404).json({ error: "Application not found" });

        const systemPrompt = `
            You are a Senior Technical Recruiter at Google. You are conducting a follow-up interview for the position of ${appData.jobTitle}.
            The candidate is ${appData.candidateName}.
            
            Context:
            - Their Resume Match Score: ${appData.matchScore}%
            - High-level feedback: ${JSON.stringify(appData.feedback.strategic_roadmap?.recruiter_verdict)}
            
            Rule:
            1. Be professional, slightly tough, but encouraging.
            2. Ask one deep technical or behavioral question at a time.
            3. Challenge their quantified results if they seem weak.
            
            Wait for the candidate's response before asking the next question.
        `;

        const messages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message }
        ];

        const completion = await groq.chat.completions.create({
            messages,
            model: "llama-3.3-70b-versatile",
        });

        const reply = completion.choices[0]?.message?.content;

        // Save to DB
        appData.interviewChat.push({ role: "user", content: message });
        appData.interviewChat.push({ role: "assistant", content: reply });
        await appData.save();

        res.json({ reply });
    } catch (error) {
        console.error("❌ Interview Chat Error:", error);
        res.status(500).json({ error: "Chat failed", details: error.message });
    }
});


// Analyze & Save Application (With SSE Streaming Support)
app.post("/api/analyze", auth, upload.single("resume"), async (req, res) => {
    // Check if streaming is requested
    const isStreaming = req.query.stream === 'true';

    if (isStreaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
    }

    const sendProgress = (data) => {
        if (isStreaming) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };

    try {
        const { jd, candidateName, jobTitle } = req.body;
        if (!req.file || !jd) throw new Error("Missing data (resume or JD)");

        sendProgress({ status: "Parsing PDF...", progress: 10 });
        const filePath = req.file.path;
        const pdfBuffer = fs.readFileSync(filePath);

        let pdfData;
        try {
            pdfData = await pdf(pdfBuffer);
        } catch (pdfErr) {
            console.error("PDF Parse Error:", pdfErr);
            throw new Error("Could not parse PDF. Please ensure it is a valid document.");
        }

        const resumeText = pdfData.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").substring(0, 20000);

        sendProgress({ status: "Analyzing core skills against JD...", progress: 30 });
        const pass1Prompt = `
      You are a Senior Technical Recruiter at Google/Meta specializing in AI, Cloud, and Software Engineering.
      Analyze the [Resume] against the [Job Description] (JD) with extreme precision.
      
      CORE LOGIC RULES:
      1. WEIGHTED SCORING: Calculate match scores based on [JD] frequency. Keywords mentioned 3+ times have 5x higher weight.
      2. THE "SO WHAT?" TEST: Evaluate every bullet point. If a point lacks a quantifiable result (%, $, time saved), mark it as "Weak" and suggest a specific quantified rewrite.
      3. PEER ANALYSIS: Compare the candidate's skills against industry standards for the [Job Title].
      
      Return strict JSON ONLY with this schema:
      {
        "match_score": number (Weighted based on JD importance),
        "ats_score": number (0-100),
        "skill_gap_data": [
            { "skill": "string", "resume_level": 0-10, "jd_importance": 0-10 }
        ],
        "hard_skills": ["string"],
        "soft_skills": ["string"],
        "breakdown": {
          "tone": { "score": number, "label": "Needs work" | "Strong", "tip": "string" },
          "content": { "score": number, "label": "Needs work" | "Strong", "tip": "string" },
          "structure": { "score": number, "label": "Needs work" | "Strong", "tip": "string" }
        },
        "ats_checklist": [{ "item": "string", "status": "pass" | "fail", "message": "string" }],
        "strengths": ["string"],
        "weaknesses": ["string"],
        "impact_rewrites": [{ "original": "string", "improved": "string", "reason": "string (Explain 'So What?' failure)" }],
        "strategic_roadmap": { "immediate_actions": ["string"], "recruiter_verdict": "string" },
        "optimized_resume_markdown": "string",
        "improvement_detail": { "tone_guide": "string", "structure_guide": "string", "content_guide": "string" }
      }
      
      Resume: ${resumeText}
      JD: ${jd}
      Job Title: ${jobTitle}
    `;

        const pass1Res = await groq.chat.completions.create({
            messages: [{ role: "user", content: pass1Prompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const initialAnalysis = JSON.parse(pass1Res.choices[0]?.message?.content || "{}");

        sendProgress({ status: "Performing self-correction & refining feedback...", progress: 60 });
        const pass2Prompt = `
      You are a Lead Career Coach at a FAANG company. Critique the following Resume Analysis for accuracy, harshness, and missing technical gaps.
      If the match score seems too high/low compared to the "Weighted Scoring" rule, adjust it.
      Ensure the "So What?" suggestions are actually actionable.
      
      Analysis to Critique:
      ${JSON.stringify(initialAnalysis)}

      Return the FINAL FIXED JSON only. Use the exact same schema.
    `;

        const pass2Res = await groq.chat.completions.create({
            messages: [{ role: "user", content: pass2Prompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const finalAnalysisJson = JSON.parse(pass2Res.choices[0]?.message?.content || "{}");

        sendProgress({ status: "Finalizing and saving result...", progress: 90 });
        const newApp = new Application({
            userId: req.user.id,
            candidateName: candidateName || "Candidate",
            jobTitle: jobTitle || "Role",
            jobDescription: jd,
            matchScore: finalAnalysisJson.match_score,
            atsScore: finalAnalysisJson.ats_score,
            feedback: finalAnalysisJson,
            resumeText: resumeText,
            resumePath: `/uploads/${req.file.filename}`,
            optimizedResumeMarkdown: finalAnalysisJson.optimized_resume_markdown,
            improvementDetail: finalAnalysisJson.improvement_detail
        });

        await newApp.save();

        if (isStreaming) {
            sendProgress({ status: "Complete", progress: 100, result: newApp });
            res.end();
        } else {
            res.json(newApp);
        }

    } catch (error) {
        console.error("❌ Analysis Error:", error);
        if (isStreaming) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: "Analysis failed", details: error.message });
        }
    }
});

app.listen(port, () => console.log(`🚀 RESUMIND Backend on port ${port}`));

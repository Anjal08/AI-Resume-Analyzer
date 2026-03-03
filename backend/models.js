const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String },
    createdAt: { type: Date, default: Date.now },
});

const ApplicationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    candidateName: String,
    jobTitle: String,
    jobDescription: String,
    matchScore: Number,
    atsScore: Number,
    feedback: Object,
    resumeText: String,
    resumePath: String,
    optimizedResumeMarkdown: String,
    improvementDetail: Object,
    interviewChat: { type: [{ role: String, content: String, timestamp: { type: Date, default: Date.now } }], default: [] },
    createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Application = mongoose.model("Application", ApplicationSchema);

module.exports = { User, Application };

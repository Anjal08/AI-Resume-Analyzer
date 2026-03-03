"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, LogOut, FileText, CheckCircle2, AlertCircle, ChevronRight,
    Trash2, Copy, Eye, Sparkles, UploadCloud, Info, Check, ExternalLink
} from "lucide-react";
import axios from "axios";
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import confetti from 'canvas-confetti';

// --- API CONFIG ---
const API_URL = "http://localhost:5000/api";

type ViewState = "auth" | "dashboard" | "analyze" | "loading" | "results" | "interview";

export default function ResumindPage() {
    const [view, setView] = useState<ViewState>("auth");
    const [isLogin, setIsLogin] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(null);
    const [applications, setApplications] = useState<any[]>([]);
    const [selectedApp, setSelectedApp] = useState<any>(null);

    // Form States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [analysisProgress, setAnalysisProgress] = useState<{ status: string, progress: number }[]>([]);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
    const [uploadForm, setUploadForm] = useState({ candidateName: "", jobTitle: "", jd: "", experience: "" });
    const [file, setFile] = useState<File | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // Persist Login
    useEffect(() => {
        const savedToken = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            setView("dashboard");
            fetchApplications(savedToken);
        }
    }, []);

    const fetchApplications = async (t: string) => {
        try {
            const res = await axios.get(`${API_URL}/applications`, {
                headers: { "x-auth-token": t }
            });
            setApplications(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAuth = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const endpoint = isLogin ? "/auth/login" : "/auth/register";
            const res = await axios.post(`${API_URL}${endpoint}`, authForm);
            loginSuccess(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || `Auth Failed. Please check your credentials.`);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/auth/google`, {
                credential: credentialResponse.credential
            });
            loginSuccess(res.data);
        } catch (err: any) {
            setError("Google Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    const loginSuccess = (data: any) => {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setView("dashboard");
        fetchApplications(data.token);
    };

    const handleLogout = () => {
        localStorage.clear();
        setUser(null);
        setToken(null);
        setView("auth");
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        console.log("🗑️ Delete button clicked for ID:", id);
        e.stopPropagation();
        if (!window.confirm("Delete this analysis permanently?")) return;

        // Optimistic UI update or visual feedback
        try {
            await axios.delete(`${API_URL}/applications/${id}`, {
                headers: { "x-auth-token": token || "" }
            });
            // Use functional update to ensure we have the latest state
            setApplications(prev => prev.filter(a => a._id !== id));
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Failed to delete application. Please try again.");
            // Refresh list from server if needed
            if (token) fetchApplications(token);
        }
    };

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return setError("Please upload a resume");
        setLoading(true);
        setView("loading");
        setAnalysisProgress([]);
        setCurrentProgress(0);

        const formData = new FormData();
        formData.append("resume", file);
        formData.append("jd", uploadForm.jd);
        formData.append("candidateName", uploadForm.candidateName || "Candidate");
        formData.append("jobTitle", uploadForm.jobTitle);

        try {
            console.log("🚀 Starting adaptive analysis stream...");

            const response = await fetch(`${API_URL}/analyze?stream=true`, {
                method: "POST",
                headers: {
                    "x-auth-token": token || "",
                },
                body: formData
            });

            if (!response.body) throw new Error("No stream found");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let buffer = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const jsonStr = line.slice(6);
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.error) throw new Error(data.error);

                            if (data.status === "Complete" && data.result) {
                                setSelectedApp(data.result);
                                if (token) fetchApplications(token);
                                setView("results");
                            } else {
                                setAnalysisProgress(prev => [...prev.slice(-4), data]);
                                setCurrentProgress(data.progress);
                            }
                        } catch (e) {
                            console.warn("Parse error in stream:", e);
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error("❌ Analysis failed:", err);
            setError(err.message || "Analysis Failed. Please check your connection.");
            setView("analyze");
        } finally {
            setLoading(false);
        }
    };

    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "922401505893-ign65r1ectmbqh8fhdueroif11qivq8a.apps.googleusercontent.com"}>
            <div className={`min-h-screen font-inter text-slate-800 ${view === 'auth' ? 'bg-gradient-to-br from-[#f8ecee] via-white to-[#e8e9fb]' : 'bg-[#FAFBFC]'}`}>

                {/* AUTH VIEW */}
                {view === "auth" && (
                    <main className="min-h-screen flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-lg bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] p-10 md:p-14 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-100 z-10"
                        >
                            <div className="text-center mb-10">
                                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-3 tracking-tight">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-indigo-500 font-medium">Welcome</span> {isLogin ? "Back" : "to App"}
                                </h1>
                                <p className="text-slate-500 text-sm md:text-base font-medium">Log In to Continue Your Job Journey</p>
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-center">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={() => setError("Google Login Failed")}
                                        useOneTap
                                        shape="pill"
                                    />
                                </div>

                                <div className="flex items-center gap-4 py-2 opacity-60">
                                    <div className="h-[1px] flex-1 bg-slate-200" />
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Or</span>
                                    <div className="h-[1px] flex-1 bg-slate-200" />
                                </div>

                                <form onSubmit={handleAuth} className="space-y-5">
                                    {!isLogin && (
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-600 pl-1">Name</label>
                                            <input
                                                type="text" className="w-full py-3.5 bg-white border border-slate-200 px-4 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all" placeholder="Enter your name" required
                                                onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-600 pl-1">Email Address</label>
                                        <input
                                            type="email" className="w-full py-3.5 bg-white border border-slate-200 px-4 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all" placeholder="name@email.com" required
                                            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-600 pl-1">Password</label>
                                        <input
                                            type="password" className="w-full py-3.5 bg-white border border-slate-200 px-4 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all" placeholder="Enter your password" required
                                            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                        />
                                    </div>

                                    {error && <p className="text-red-500 text-sm font-medium text-center bg-red-50 py-3 rounded-xl border border-red-100">{error}</p>}

                                    <button type="submit" disabled={loading} className="w-full py-4 mt-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-semibold text-base transition-all shadow-md shadow-indigo-200">
                                        {loading ? "Please wait..." : isLogin ? "Log In" : "Sign Up"}
                                    </button>
                                </form>
                            </div>

                            <div className="mt-8 text-center text-sm font-medium text-slate-500">
                                {isLogin ? "Don't have an account?" : "Already have an account?"} {" "}
                                <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
                                    {isLogin ? "Sign up" : "Log in"}
                                </button>
                            </div>
                        </motion.div>
                    </main>
                )}

                {/* MAIN APP SHELL */}
                {view !== "auth" && (
                    <div className="max-w-[1600px] mx-auto min-h-screen flex flex-col">
                        {/* Header */}
                        <nav className="flex items-center justify-between py-6 px-6 lg:px-12 bg-white border-b border-slate-100 sticky top-0 z-50">
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView("dashboard")}>
                                    <span className="text-xl font-bold tracking-tight text-slate-800">ResumeAnalyzer</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <span className="text-sm font-medium text-slate-600 hidden md:inline-block">{user?.email}</span>
                                <button onClick={handleLogout} className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
                                    Log out
                                </button>
                            </div>
                        </nav>

                        <AnimatePresence mode="wait">
                            {/* DASHBOARD */}
                            {view === "dashboard" && (
                                <motion.main key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 p-6 lg:p-12">
                                    <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Your Analyses</h2>
                                        <button onClick={() => setView("analyze")} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-all shadow-sm">
                                            <Plus className="w-4 h-4" /> New Analysis
                                        </button>
                                    </header>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {applications.length === 0 && (
                                            <div className="col-span-full py-20 text-center border border-dashed border-slate-300 rounded-2xl bg-white">
                                                <p className="text-slate-500 font-medium">No analyses yet. Start by uploading a resume.</p>
                                            </div>
                                        )}
                                        {applications.map(app => (
                                            <ApplicationCard
                                                key={app._id} app={app}
                                                onClick={() => { setSelectedApp(app); setView("results"); }}
                                                onDelete={(e) => handleDelete(e, app._id)}
                                            />
                                        ))}
                                    </div>
                                </motion.main>
                            )}

                            {/* ANALYZE (UPLOAD FORM) */}
                            {view === "analyze" && (
                                <motion.main key="analyze" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 p-6 lg:p-12 flex justify-center bg-gradient-to-br from-[#fdfbfb] to-[#ebedee]">
                                    <div className="w-full max-w-3xl">
                                        <form onSubmit={handleAnalyze} className="bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 space-y-8 relative overflow-hidden">
                                            <div className="relative z-10 space-y-7">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-600 block">Candidate Name (Optional)</label>
                                                    <input type="text" className="w-full py-3.5 bg-white border border-slate-200 px-4 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all shadow-sm" placeholder="Enter name" onChange={(e) => setUploadForm({ ...uploadForm, candidateName: e.target.value })} />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-600 block">Select Job</label>
                                                    <input type="text" className="w-full py-3.5 bg-white border border-slate-200 px-4 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all shadow-sm" placeholder="e.g. Frontend Developer" required onChange={(e) => setUploadForm({ ...uploadForm, jobTitle: e.target.value })} />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-600 block">Job Description</label>
                                                    <textarea className="w-full h-32 py-3.5 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all shadow-sm resize-none" placeholder="Write a clear & concise job description with responsibilities & expectations..." required onChange={(e) => setUploadForm({ ...uploadForm, jd: e.target.value })} />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-600 block">Years of Experience</label>
                                                    <input type="text" className="w-full py-3.5 bg-white border border-slate-200 px-4 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all shadow-sm" placeholder="Enter number of years" onChange={(e) => setUploadForm({ ...uploadForm, experience: e.target.value })} />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-600 block">Upload Resume</label>
                                                    <div className={`relative bg-[#f8fafc] border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer hover:bg-slate-50 ${file ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200'}`} onClick={() => document.getElementById('upload')?.click()}>
                                                        <input id="upload" type="file" hidden accept=".pdf" onChange={(e: any) => setFile(e.target.files?.[0])} />
                                                        <div className="w-14 h-14 bg-gradient-to-b from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-sm border border-slate-300">
                                                            <UploadCloud className="w-7 h-7" />
                                                        </div>
                                                        <p className="font-semibold text-slate-700 mb-1">{file ? file.name : "Click to upload or drag and drop"}</p>
                                                        <p className="text-xs text-slate-500 font-medium tracking-wide">PDF (max. 10MB)</p>
                                                    </div>
                                                </div>

                                                {error && (
                                                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium animate-pulse flex items-center gap-2">
                                                        <AlertCircle className="w-4 h-4" />
                                                        {error}
                                                    </div>
                                                )}

                                                <button type="submit" className="w-full py-4 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl font-semibold text-[15px] shadow-sm transition-all mt-4">
                                                    {loading ? "Analyzing..." : "Save & Analyze Resume"}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </motion.main>
                            )}

                            {/* LOADING */}
                            {view === "loading" && (
                                <motion.main key="loading" className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-900 text-white min-h-[calc(100vh-80px)]">
                                    <div className="w-full max-w-xl space-y-12">
                                        <div className="relative">
                                            <div className="w-24 h-24 border-2 border-indigo-500/20 rounded-full mx-auto" />
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                className="absolute inset-x-0 top-0 w-24 h-24 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center font-black text-xl text-indigo-400">
                                                {currentProgress}%
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h2 className="text-3xl font-black tracking-tighter">AI AGENT DEPLOYED.</h2>
                                            <p className="text-slate-400 font-medium">Processing resume through multi-pass recruiter filters...</p>
                                        </div>

                                        <div className="bg-black/40 rounded-2xl p-6 font-mono text-left space-y-3 border border-white/5">
                                            {analysisProgress.map((p, i) => (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    key={i}
                                                    className="flex items-center gap-3 text-sm"
                                                >
                                                    <span className="text-indigo-500 font-bold">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                                    <span className={i === analysisProgress.length - 1 ? "text-emerald-400" : "text-slate-500"}>
                                                        {p.status}
                                                    </span>
                                                    {i === analysisProgress.length - 1 && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
                                                </motion.div>
                                            ))}
                                            {analysisProgress.length === 0 && (
                                                <div className="text-slate-600 italic">Initializing stream...</div>
                                            )}
                                        </div>
                                    </div>
                                </motion.main>
                            )}

                            {/* RESULTS */}
                            {view === "results" && selectedApp && (
                                <ResultsView
                                    app={selectedApp}
                                    onBack={() => setView("dashboard")}
                                    onInterview={() => setView("interview")}
                                />
                            )}

                            {/* INTERVIEW VIEW */}
                            {view === "interview" && selectedApp && (
                                <InterviewView
                                    app={selectedApp}
                                    onBack={() => setView("results")}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                )}

            </div>
        </GoogleOAuthProvider>
    );
}

// --- SUB-COMPONENTS ---

function ApplicationCard({ app, onClick, onDelete }: { app: any, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onClick}
            className="bg-white rounded-2xl p-6 cursor-pointer group shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all relative flex flex-col h-48"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1 truncate group-hover:text-[#6366f1] transition-colors">{app.jobTitle}</h3>
                    <p className="text-xs font-medium text-slate-500">{app.candidateName || "Candidate"}</p>
                </div>
                <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0 bg-slate-50 rounded-full border border-slate-100">
                    <span className="text-sm font-bold text-slate-800">{Math.round(app.matchScore)}</span>
                </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                <div className="text-slate-400 font-medium text-xs">
                    {new Date(app.createdAt).toLocaleDateString()}
                </div>
                <button
                    onClick={onDelete}
                    className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}

function ResultsView({ app, onBack, onInterview }: { app: any, onBack: () => void, onInterview: () => void }) {
    const [showScanner, setShowScanner] = useState(false);
    const data = app.feedback || {};
    const roadmap = data.strategic_roadmap || {};
    const skillData = data.skill_gap_data || [];

    useEffect(() => {
        if (app.matchScore >= 85) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#a855f7', '#ec4899']
            });
        }
    }, [app.matchScore]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 p-6 lg:p-10 w-full max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC]">
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="group text-sm font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white hover:shadow-sm transition-all">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Dashboard
                    </button>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{app.jobTitle}</span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onInterview}
                        className="text-xs font-bold px-4 py-2 rounded-xl transition-all border flex items-center gap-2 bg-indigo-600 border-indigo-600 text-white shadow-lg hover:bg-indigo-700"
                    >
                        <Sparkles className="w-4 h-4" />
                        De-brief with AI
                    </button>
                    <button
                        onClick={() => setShowScanner(!showScanner)}
                        className={`text-xs font-bold px-4 py-2 rounded-xl transition-all border flex items-center gap-2 ${showScanner ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                        <Eye className="w-4 h-4" />
                        {showScanner ? "Close Scanner View" : "ATS Scanner Mode"}
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-10 items-stretch">
                {/* LEFT PANE: Pure Resume View */}
                <div className="w-full lg:w-[45%] h-[calc(100vh-160px)] sticky top-24">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 h-full overflow-hidden flex flex-col group relative">
                        <div className="absolute top-6 left-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="px-3 py-1.5 bg-white/80 backdrop-blur-md rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-slate-100 shadow-sm">Original Document View</span>
                        </div>

                        <div className="flex-1 bg-[#F1F5F9]">
                            {app.resumePath ? (
                                <iframe src={`http://localhost:5000${app.resumePath}#toolbar=0&navpanes=0`} className="w-full h-full border-none" title="Resume View" />
                            ) : (
                                <div className="p-12 text-sm text-slate-600 font-medium whitespace-pre-wrap leading-relaxed h-full overflow-y-auto custom-scrollbar">
                                    {app.resumeText}
                                </div>
                            )}
                        </div>

                        {/* Scanner Overlay */}
                        <AnimatePresence>
                            {showScanner && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-20 flex flex-col p-10"
                                >
                                    <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                                        <h3 className="text-white font-bold flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-emerald-400" />
                                            ATS Plain Text Perspective
                                        </h3>
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md font-bold uppercase tracking-widest">Optimized for Parsing</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto font-mono text-emerald-400/80 text-[13px] leading-relaxed custom-scrollbar selection:bg-emerald-500/30">
                                        {app.resumeText || "No plain text available."}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* RIGHT PANE: Strategic Analysis */}
                <div className="w-full lg:w-[55%] h-[calc(100vh-160px)] overflow-y-auto pr-2 custom-scrollbar space-y-8">

                    {/* Hero Score Card */}
                    <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8">
                            <div className="flex -space-x-4">
                                {[1, 2, 3].map(i => <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-100"></div>)}
                                <div className="w-10 h-10 rounded-full border-4 border-white bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600">+12k</div>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 text-right">Compared to Peers</p>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-12">
                            <div className="relative w-44 h-44 flex-shrink-0">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="88" cy="88" r="78" fill="none" stroke="#F1F5F9" strokeWidth="16" />
                                    <motion.circle
                                        cx="88" cy="88" r="78" fill="none" stroke="url(#scoreGradV5)"
                                        strokeWidth="16" strokeDasharray={490}
                                        initial={{ strokeDashoffset: 490 }}
                                        animate={{ strokeDashoffset: 490 - (490 * app.matchScore) / 100 }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        strokeLinecap="round"
                                    />
                                    <defs>
                                        <linearGradient id="scoreGradV5" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#4F46E5" />
                                            <stop offset="100%" stopColor="#818CF8" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-slate-900">{Math.round(app.matchScore)}%</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Match</span>
                                </div>
                            </div>

                            <div className="flex-1 space-y-4 text-center md:text-left">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">
                                    Strategic Analysis <br />
                                    <span className="text-indigo-600">Expert Verdict.</span>
                                </h2>
                                <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-md">
                                    {roadmap.recruiter_verdict || "Our AI, modeled on Google Senior Tier hiring standards, has evaluated your profile against the target role requirements."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Skill Gap Analysis (Radar Chart) */}
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-500" />
                            Competency Mapping
                        </h3>
                        <p className="text-xs font-medium text-slate-400 mb-8 uppercase tracking-widest">Weighted Skill Gap vs Industry Benchmark</p>

                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillData.length > 0 ? skillData : [
                                    { skill: 'Logic', resume_level: 8, jd_importance: 9 },
                                    { skill: 'Systems', resume_level: 6, jd_importance: 8 },
                                    { skill: 'Impact', resume_level: 5, jd_importance: 10 },
                                    { skill: 'Tools', resume_level: 9, jd_importance: 7 },
                                    { skill: 'Soft Skills', resume_level: 7, jd_importance: 6 }
                                ]}>
                                    <PolarGrid stroke="#E2E8F0" />
                                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                                    <Radar
                                        name="Your Level"
                                        dataKey="resume_level"
                                        stroke="#4F46E5"
                                        fill="#4F46E5"
                                        fillOpacity={0.4}
                                    />
                                    <Radar
                                        name="Job Requirement"
                                        dataKey="jd_importance"
                                        stroke="#94A3B8"
                                        fill="#94A3B8"
                                        fillOpacity={0.1}
                                    />
                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Actionable Rewrites Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Quick Fixes (Direct Impact)</h3>
                            <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest">High ROI</div>
                        </div>

                        <div className="grid gap-6">
                            {data.impact_rewrites?.map((rewrite: any, i: number) => (
                                <motion.div
                                    whileHover={{ y: -2 }}
                                    key={i}
                                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rewrite suggestion #{i + 1}</span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(rewrite.improved);
                                            }}
                                            className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy Fix
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="relative pl-4 border-l-2 border-slate-100">
                                            <p className="text-sm text-slate-400 line-through decoration-slate-200">{rewrite.original}</p>
                                        </div>
                                        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-20" />
                                            </div>
                                            <p className="text-sm text-emerald-900 font-bold leading-relaxed">{rewrite.improved}</p>
                                        </div>
                                        <div className="flex items-start gap-2 text-[11px] font-bold text-amber-600/80 bg-amber-50/30 p-2 px-3 rounded-lg">
                                            <Info className="w-3.5 h-3.5" />
                                            Reason: {rewrite.reason}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Improvements Hub */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ImprovementCardV5
                            title="Tone & Narrative"
                            score={data.breakdown?.tone?.score}
                            tip={data.breakdown?.tone?.tip}
                        />
                        <ImprovementCardV5
                            title="Impact Density"
                            score={data.breakdown?.content?.score}
                            tip={data.breakdown?.content?.tip}
                        />
                        <ImprovementCardV5
                            title="Layout Fidelity"
                            score={data.breakdown?.structure?.score}
                            tip={data.breakdown?.structure?.tip}
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function ImprovementCardV5({ title, score, tip }: { title: string, score: number, tip: string }) {
    const isGood = score >= 80;
    return (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isGood ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {score || 0}%
            </div>
            <div>
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest">{title}</h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">
                    {tip ? (tip.length > 60 ? tip.substring(0, 60) + "..." : tip) : "Refine your phrasing to match industry standards."}
                </p>
            </div>
        </div>
    );
}

function InterviewView({ app, onBack }: { app: any, onBack: () => void }) {
    const [messages, setMessages] = useState<any[]>(app.interviewChat || []);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("💬 Sending chat message:", input);
        if (!input.trim() || loading) return;

        const userMsg = { role: "user", content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${API_URL}/chat/interview`, {
                applicationId: app._id,
                message: input,
                history: messages
            }, {
                headers: { "x-auth-token": token || "" }
            });

            setMessages(prev => [...prev, { role: "assistant", content: res.data.reply }]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-80px)] bg-slate-50">
            <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
                <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-slate-900 flex items-center gap-2">
                    ← Back to Analysis
                </button>
                <div className="text-center">
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">AI Interview Room</h2>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Target: {app.jobTitle}</p>
                </div>
                <div className="w-20" /> {/* Spacer */}
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-6 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="text-center py-20 space-y-4">
                        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                            <Sparkles className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900">Ready for your mock interview?</h3>
                        <p className="text-slate-500 max-w-sm mx-auto text-sm">Our AI recruiter has analyzed your resume. Send a message to start the roleplay.</p>
                    </div>
                )}
                {messages.map((m, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={i}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[80%] p-5 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                            <p className="text-sm leading-relaxed font-medium">{m.content}</p>
                        </div>
                    </motion.div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-2">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 bg-white border-t border-slate-100">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-4">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your response..."
                        className="flex-1 py-4 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all font-medium text-sm"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="bg-indigo-600 text-white px-8 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}

/* eslint-disable */
// src/App.js
import { useState, useEffect, useRef, useCallback } from "react";
import {
  registerUser, loginUser, logoutUser, onAuthChange,
  saveProfile, saveLesson, saveTest, saveEssay, updateEssay,
  advanceDay, advanceLesson, getAllUsers, getUserData
} from "./supabase";
import {
  generateLesson, generateTest, evaluateSubmission,
  assessLevel, generateEssayTopic, evaluateEssay
} from "./gemini";

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "admin123";
const SKILLS = ["Vocabulary", "Grammar", "Spelling", "Reading Comprehension", "Writing", "Essay", "Speaking"];

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink:"#1a1a2e", navy:"#16213e", royal:"#0f3460",
  teal:"#00b4d8", sky:"#90e0ef", mint:"#48cae4",
  gold:"#f4a261", coral:"#e76f51", sage:"#52b788",
  cream:"#f8f9fa", muted:"#6c757d", white:"#ffffff",
  error:"#e63946", warn:"#ffb703", purple:"#7b2d8b"
};
const S = {
  app:{ minHeight:"100vh", background:`linear-gradient(135deg,${C.ink} 0%,${C.navy} 50%,${C.royal} 100%)`, fontFamily:"'Segoe UI',system-ui,sans-serif", color:C.cream },
  card:{ background:"rgba(255,255,255,0.05)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:24 },
  btn:(bg,color="#fff")=>({ background:bg, color, border:"none", borderRadius:10, padding:"10px 20px", cursor:"pointer", fontWeight:600, fontSize:14, transition:"all 0.2s", display:"inline-flex", alignItems:"center", gap:6 }),
  input:{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:"10px 14px", color:C.cream, fontSize:14, width:"100%", outline:"none", boxSizing:"border-box" },
  label:{ fontSize:13, fontWeight:600, color:C.sky, marginBottom:4, display:"block" },
  h1:{ fontSize:28, fontWeight:800, margin:0 },
  h2:{ fontSize:22, fontWeight:700, margin:"0 0 12px" },
  h3:{ fontSize:17, fontWeight:700, margin:"0 0 8px" },
  tag:(bg)=>({ background:bg, color:"#fff", borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:700, display:"inline-block" }),
  prog:(pct,color=C.teal)=>({
    outer:{ background:"rgba(255,255,255,0.1)", borderRadius:99, height:8, overflow:"hidden" },
    inner:{ width:`${pct}%`, background:color, height:"100%", borderRadius:99, transition:"width 0.5s" }
  })
};

// ── Micro components ──────────────────────────────────────────────────────────
function Spinner({ label="" }) {
  return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:32, gap:12 }}>
    <div style={{ width:36, height:36, border:`3px solid rgba(255,255,255,0.1)`, borderTop:`3px solid ${C.teal}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
    {label && <div style={{ fontSize:13, color:C.sky, textAlign:"center" }}>{label}</div>}
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
function Badge({ children, color=C.teal }) { return <span style={S.tag(color)}>{children}</span>; }
function Alert({ type="info", children }) {
  const colors = { info:C.teal, success:C.sage, warn:C.warn, error:C.error };
  return <div style={{ background:`${colors[type]}22`, border:`1px solid ${colors[type]}44`, borderRadius:10, padding:"12px 16px", fontSize:14, marginBottom:12 }}>{children}</div>;
}
function ScoreBar({ label, score }) {
  const color = score>=75?C.sage:score>=60?C.warn:C.error;
  const p = S.prog(score, color);
  return <div style={{ marginBottom:10 }}>
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
      <span>{label}</span><span style={{ fontWeight:700, color }}>{score}%</span>
    </div>
    <div style={p.outer}><div style={p.inner}/></div>
  </div>;
}
function SpeakButton({ text }) {
  return <button onClick={()=>{ const u=new SpeechSynthesisUtterance(text); u.rate=0.85; u.lang="en-US"; window.speechSynthesis?.speak(u); }} style={{ ...S.btn(C.royal), padding:"5px 10px", fontSize:12 }}>🔊 Hear</button>;
}

// ── Speech hook ───────────────────────────────────────────────────────────────
function useSpeech() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const supported = !!SR;
  const BROWSER_ERROR_MSG = "Microphone not available in this browser. Please use Chrome for voice recording, or type your response below.";
  const start = useCallback(()=>{
    if (!supported) { setError(BROWSER_ERROR_MSG); return; }
    const rec = new SR(); rec.continuous=true; rec.interimResults=true; rec.lang="en-US";
    rec.onstart=()=>setListening(true);
    rec.onresult=(e)=>{ let t=""; for(let i=0;i<e.results.length;i++) if(e.results[i].isFinal) t+=e.results[i][0].transcript+" "; setTranscript(t.trim()); };
    rec.onerror=(e)=>{
      if (e.error==="service-not-allowed" || e.error==="not-allowed") setError(BROWSER_ERROR_MSG);
      else setError(e.error);
      setListening(false);
    };
    rec.onend=()=>setListening(false);
    recRef.current=rec; rec.start();
  },[SR, supported, BROWSER_ERROR_MSG]);
  const stop = useCallback(()=>{ recRef.current?.stop(); setListening(false); },[]);
  const reset = useCallback(()=>{ setTranscript(""); setError(""); },[]);
  return { listening, transcript, error, start, stop, reset };
}

// ── Reminder helper ───────────────────────────────────────────────────────────
function scheduleReminder(essayTitle, days) {
  if (!("Notification" in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm === "granted") {
      setTimeout(() => {
        new Notification("📝 VocabMentor — Essay Reminder", {
          body: `Time to resubmit your essay: "${essayTitle}". You've done your reading — now show your improvement!`,
          icon: "📚"
        });
      }, days * 24 * 60 * 60 * 1000);
    }
  });
}

// ── Landing / Auth ────────────────────────────────────────────────────────────
function LandingPage({ onLogin, onGuest, onAdmin, loading }) {
  const [mode, setMode] = useState("landing");
  const [form, setForm] = useState({ username:"", email:"", password:"", confirm:"" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const doRegister = async () => {
    if (!form.username.trim()||!form.email.trim()||!form.password) return setErr("Please fill all fields.");
    if (form.password !== form.confirm) return setErr("Passwords don't match.");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");
    setBusy(true); setErr("");
    try { const u = await registerUser(form.email, form.password, form.username); onLogin(u); }
    catch(e) { setErr(e.message||"Registration failed. Try a different email."); }
    setBusy(false);
  };
  const doLogin = async () => {
    if (!form.email||!form.password) return setErr("Enter email and password.");
    setBusy(true); setErr("");
    try { const u = await loginUser(form.email, form.password); onLogin(u); }
    catch(e) { setErr("Invalid email or password."); }
    setBusy(false);
  };
  const doAdmin = () => { if(form.password===ADMIN_PASSWORD) onAdmin(); else setErr("Wrong admin password."); };

  if (loading) return <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner label="Loading VocabMentor..."/></div>;

  if (mode==="landing") return (
    <div style={{ ...S.app, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, textAlign:"center" }}>
      <div style={{ fontSize:60, marginBottom:12 }}>📚</div>
      <h1 style={{ ...S.h1, fontSize:40, background:`linear-gradient(90deg,${C.sky},${C.gold})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8 }}>VocabMentor</h1>
      <p style={{ color:C.sky, fontSize:15, maxWidth:440, marginBottom:32, lineHeight:1.6 }}>Your adaptive English tutor — vocabulary, grammar, essays, speaking & confidence. Free for everyone.</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center", marginBottom:28 }}>
        {[["🎓","Students","Grade-aligned lessons, essay writing & comprehension"],["💼","Professionals","Career vocab, writing & speaking skills"],["🌱","Personal Growth","Daily confidence at your own pace"]].map(([icon,t,d])=>(
          <div key={t} style={{ ...S.card, width:175, textAlign:"left" }}>
            <div style={{ fontSize:30, marginBottom:8 }}>{icon}</div>
            <div style={{ fontWeight:700, marginBottom:4 }}>{t}</div>
            <div style={{ fontSize:12, color:C.sky }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        <button style={S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`)} onClick={()=>setMode("register")}>✨ Create Free Profile</button>
        <button style={S.btn("rgba(255,255,255,0.1)")} onClick={()=>setMode("login")}>Log In</button>
        <button style={S.btn("rgba(255,255,255,0.05)")} onClick={onGuest}>👀 Preview</button>
      </div>
      <button style={{ marginTop:20, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12 }} onClick={()=>setMode("admin")}>Admin</button>
    </div>
  );

  const isLogin=mode==="login", isAdmin=mode==="admin";
  return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ ...S.card, width:"100%", maxWidth:420 }}>
        <button onClick={()=>{setMode("landing");setErr("");}} style={{ background:"none", border:"none", color:C.sky, cursor:"pointer", marginBottom:16, fontSize:13 }}>← Back</button>
        <h2 style={S.h2}>{isAdmin?"🔐 Admin":isLogin?"Welcome Back 👋":"Create Profile ✨"}</h2>
        {err && <Alert type="error">{err}</Alert>}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!isAdmin&&!isLogin && <div><label style={S.label}>Display name</label><input style={S.input} placeholder="Your name" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></div>}
          {!isAdmin && <div><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>}
          <div><label style={S.label}>Password{isAdmin?" (admin)":""}</label><input style={S.input} type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>
          {!isLogin&&!isAdmin && <div><label style={S.label}>Confirm password</label><input style={S.input} type="password" placeholder="Confirm" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})}/></div>}
          <button style={S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`)} onClick={isAdmin?doAdmin:isLogin?doLogin:doRegister} disabled={busy}>
            {busy?"Please wait...":isAdmin?"Enter Admin":isLogin?"Log In":"Get Started Free"}
          </button>
          {!isAdmin && <p style={{ textAlign:"center", fontSize:13, color:C.muted }}>
            {isLogin?"No account? ":"Have one? "}
            <button onClick={()=>{setMode(isLogin?"register":"login");setErr("");}} style={{ background:"none", border:"none", color:C.teal, cursor:"pointer", fontWeight:700 }}>
              {isLogin?"Register free":"Log in"}
            </button>
          </p>}
        </div>
      </div>
    </div>
  );
}

// ── Profile Setup ─────────────────────────────────────────────────────────────
function ProfileSetup({ user, onComplete }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState("");
  const [form, setForm] = useState({});
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);

  const sQ = [
    { id:"q1", text:"Read this: 'The sun rises in the east and sets in the west. Sailors used this to navigate.' — What did sailors use to navigate?" },
    { id:"q2", text:"Choose the correct word: 'She _____ to school every day.' (go / goes / going)" },
    { id:"q3", text:"Correct this sentence: 'He don't like vegetables.'" },
    { id:"q4", text:"Write 3–4 sentences about your favourite place." },
    { id:"q5", text:"What does the word 'enormous' mean? Use it in a sentence." }
  ];
  const aQ = [
    { id:"q1", text:"Write a 3-sentence professional email requesting a meeting with your manager." },
    { id:"q2", text:"Choose: 'The team needs to _____ this issue before the deadline.' (mitigate/migrate/motivate/moderate)" },
    { id:"q3", text:"Correct: 'Between you and I, the project is going well.'" },
    { id:"q4", text:"In 2–3 sentences, describe what you do in your job to someone unfamiliar with it." },
    { id:"q5", text:"What does 'proactive' mean? Use it in a work sentence." }
  ];

  const runAssessment = async () => {
    setLoading(true);
    const result = await assessLevel({ ...form, type }, answers);
    if (result.type==="assessment") {
      const profile = { ...form, type, level:result.level, assessmentResult:result };
      await saveProfile(user.id, profile);
      setAssessment(result);
      setLoading(false);
      setTimeout(()=>onComplete({ ...user, profile, current_lesson:1, current_day:1 }), 3500);
    } else setLoading(false);
  };

  if (step===0) return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ maxWidth:500, width:"100%" }}>
        <h2 style={{ ...S.h2, textAlign:"center" }}>Welcome, {user.username}! 👋</h2>
        <p style={{ textAlign:"center", color:C.sky, marginBottom:24 }}>Who is this profile for?</p>
        <div style={{ display:"flex", gap:16 }}>
          {[["🎓","Student","School learners — grades, essays & comprehension","student"],["💼","Adult Learner","Career & personal confidence building","adult"]].map(([icon,label,desc,val])=>(
            <div key={val} onClick={()=>{setType(val);setStep(1);}} style={{ ...S.card, flex:1, cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>{icon}</div>
              <div style={{ fontWeight:700, marginBottom:8 }}>{label}</div>
              <div style={{ fontSize:12, color:C.sky }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (step===1) {
    const fields = type==="student"
      ? [["name","Your name","text"],["age","Age","number"],["grade","Grade (e.g. Grade 5)","text"],["interests","Interests (e.g. sports, science, history)","text"],["challenge","What's hardest in English?","text"],["goal","Your goal","text"]]
      : [["name","Your name","text"],["age","Age","number"],["career","Career / role","text"],["goal","Your goal (career, confidence, etc.)","text"],["challenge","Biggest English challenge","text"]];
    return (
      <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ ...S.card, maxWidth:480, width:"100%" }}>
          <h2 style={S.h2}>Tell us about yourself 📝</h2>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {fields.map(([key,label,t])=>(
              <div key={key}><label style={S.label}>{label}</label>
                <input style={S.input} type={t} value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})}/>
              </div>
            ))}
            <button style={S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`)} onClick={()=>setStep(2)}>Continue →</button>
          </div>
        </div>
      </div>
    );
  }

  const qs = type==="student" ? sQ : aQ;
  return (
    <div style={{ ...S.app, padding:24 }}>
      <div style={{ maxWidth:640, margin:"0 auto" }}>
        <div style={{ ...S.card, marginBottom:16 }}>
          <h2 style={S.h2}>Quick Level Assessment 🎯</h2>
          <p style={{ color:C.sky, fontSize:14 }}>Answer honestly — this helps us personalise your lessons perfectly!</p>
        </div>
        {qs.map((q,i)=>(
          <div key={q.id} style={{ ...S.card, marginBottom:12 }}>
            <div style={{ fontSize:13, color:C.gold, fontWeight:700, marginBottom:6 }}>Question {i+1}</div>
            <p style={{ fontSize:15, marginBottom:10 }}>{q.text}</p>
            <textarea style={{ ...S.input, minHeight:80, resize:"vertical" }} placeholder="Your answer..." value={answers[q.id]||""} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}/>
          </div>
        ))}
        <button style={{ ...S.btn(`linear-gradient(135deg,${C.gold},${C.coral})`), width:"100%", justifyContent:"center", padding:14 }} onClick={runAssessment} disabled={loading}>
          {loading?"Analysing your answers...":"✨ Get My Learning Plan"}
        </button>
        {loading && <Spinner label="Gemini is assessing your level..."/>}
        {assessment && (
          <div style={{ ...S.card, marginTop:16, textAlign:"center" }}>
            <div style={{ fontSize:42, marginBottom:8 }}>🎉</div>
            <h2 style={S.h2}>Your level: <span style={{ color:C.gold }}>{assessment.level}</span></h2>
            <p style={{ color:C.sky, marginBottom:16 }}>{assessment.encouragement}</p>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontWeight:700, color:C.sage, marginBottom:6 }}>💪 Strengths:</div>
              {assessment.strengths?.map((s,i)=><div key={i} style={{ fontSize:13, marginBottom:4 }}>✓ {s}</div>)}
              <div style={{ fontWeight:700, color:C.coral, margin:"12px 0 6px" }}>🎯 Focus areas:</div>
              {assessment.areasToImprove?.map((s,i)=><div key={i} style={{ fontSize:13, marginBottom:4 }}>→ {s}</div>)}
            </div>
            <p style={{ fontSize:12, color:C.muted, marginTop:12 }}>Taking you to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Essay View ────────────────────────────────────────────────────────────────
function EssayView({ user, onBack }) {
  const [stage, setStage] = useState("loading"); // loading|topic|write|resources|rewrite|result
  const [topic, setTopic] = useState(null);
  const [essay, setEssay] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [rewriteEssay, setRewriteEssay] = useState("");
  const [rewriteEval, setRewriteEval] = useState(null);
  const [savedEssayId, setSavedEssayId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [draftSaved, setDraftSaved] = useState(false);
  const essayDraftKey = `essay_draft_${user.id}`;

  // Check if there's a pending essay (resubmission due)
  useEffect(()=>{
    const pending = user.essays?.find(e => e.status === "pending_rewrite");
    if (pending) {
      setTopic(pending.topic_data);
      setEvaluation(pending.first_evaluation);
      setSavedEssayId(pending.id);
      setEssay(pending.first_essay);
      setStage("rewrite");
    } else {
      const savedDraft = localStorage.getItem(`essay_draft_${user.id}`);
      if (savedDraft) { setEssay(savedDraft); setWordCount(savedDraft.trim().split(/\s+/).filter(Boolean).length); }
      loadTopic();
    }
  },[]);

  useEffect(()=>{
    if (stage !== "topic" || !essay) return;
    localStorage.setItem(essayDraftKey, essay);
    setDraftSaved(true);
    const t = setTimeout(() => setDraftSaved(false), 2000);
    return () => clearTimeout(t);
  },[essay, stage]);

  const loadTopic = async () => {
    setStage("loading");
    const result = await generateEssayTopic(user.profile);
    if (result.type==="essay_topic") { setTopic(result); setStage("topic"); }
  };

  const submitEssay = async () => {
    setBusy(true);
    const result = await evaluateEssay(user.profile, topic.title, essay);
    setBusy(false);
    if (result.type==="essay_evaluation") {
      setEvaluation(result);
      localStorage.removeItem(essayDraftKey);
      const saved = await saveEssay(user.id, {
        topic_data: topic,
        first_essay: essay,
        first_evaluation: result,
        status: "pending_rewrite",
        created_at: new Date().toISOString()
      });
      setSavedEssayId(saved.id);
      scheduleReminder(topic.title, topic.reminderDays || 2);
      setStage("resources");
    }
  };

  const submitRewrite = async () => {
    setBusy(true);
    const result = await evaluateEssay(user.profile, topic.title, rewriteEssay, true, essay);
    setBusy(false);
    if (result.type==="essay_evaluation") {
      setRewriteEval(result);
      if (savedEssayId) {
        await updateEssay(savedEssayId, {
          rewrite_essay: rewriteEssay,
          rewrite_evaluation: result,
          status: "completed"
        });
      }
      setStage("result");
    }
  };

  const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

  const resourceIcons = { article:"📰", video:"🎬", wikipedia:"📖" };

  if (stage==="loading") return <div style={{ padding:40 }}><Spinner label="Generating your essay topic..."/></div>;

  return (
    <div style={{ paddingBottom:80 }}>
      <div style={{ background:`linear-gradient(135deg,${C.purple},${C.navy})`, padding:"20px 24px", marginBottom:20 }}>
        <div style={{ maxWidth:720, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <Badge color={C.purple}>✍️ Essay Writing</Badge>
            <h2 style={{ ...S.h2, marginTop:8, marginBottom:0 }}>{topic?.title || "Essay"}</h2>
            <span style={{ fontSize:13, color:C.sky }}>
              {stage==="topic"?"Step 1: Read the topic & write your essay":
               stage==="resources"?"Step 2: Read these resources, then rewrite":
               stage==="rewrite"?"Step 3: Rewrite with new knowledge":
               "Essay Complete! 🎉"}
            </span>
          </div>
          <button onClick={onBack} style={{ ...S.btn("rgba(255,255,255,0.1)"), padding:"6px 12px", fontSize:12 }}>← Back</button>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"0 16px" }}>

        {/* Step indicator */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {[["1","Write","topic"],["2","Read & Research","resources"],["3","Rewrite","rewrite"],["4","Final Result","result"]].map(([num,label,s])=>{
            const stages = ["topic","resources","rewrite","result"];
            const idx = stages.indexOf(stage);
            const thisIdx = stages.indexOf(s);
            const done = idx > thisIdx, current = idx === thisIdx;
            return (
              <div key={num} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:done?C.sage:current?C.purple:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, border:current?`2px solid ${C.gold}`:"none" }}>
                  {done?"✓":num}
                </div>
                <span style={{ fontSize:12, color:current?C.gold:done?C.sage:C.muted }}>{label}</span>
                {num!=="4" && <span style={{ color:C.muted, fontSize:12 }}>→</span>}
              </div>
            );
          })}
        </div>

        {/* STAGE: Topic + First Write */}
        {stage==="topic" && topic && <>
          <div style={{ ...S.card, marginBottom:16 }}>
            <h3 style={S.h3}>📋 Essay Brief</h3>
            <div style={{ background:"rgba(123,45,139,0.15)", borderLeft:`3px solid ${C.purple}`, padding:"12px 16px", borderRadius:"0 10px 10px 0", marginBottom:12 }}>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>{topic.title}</div>
              <p style={{ fontSize:14, color:C.sky, margin:0 }}>{topic.background}</p>
            </div>
            <p style={{ fontSize:14, marginBottom:12 }}>{topic.instructions}</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {[["📝 Introduction", topic.structure?.introduction],["📄 Body", topic.structure?.body],["🎯 Conclusion", topic.structure?.conclusion]].map(([t,d])=>(
                <div key={t} style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:12 }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:4, color:C.gold }}>{t}</div>
                  <div style={{ fontSize:12, color:C.sky }}>{d}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:13, color:C.muted }}>📏 {topic.minWords}–{topic.maxWords} words</div>
          </div>

          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <h3 style={{ ...S.h3, marginBottom:0 }}>✍️ Write Your Essay</h3>
              <span style={{ fontSize:13, color:wordCount>=topic.minWords?C.sage:C.warn }}>{wordCount} words</span>
            </div>
            <p style={{ fontSize:13, color:C.sky, marginBottom:10 }}>Write your first draft. Don't worry about being perfect — this is your starting point!</p>
            <textarea style={{ ...S.input, minHeight:280, resize:"vertical", lineHeight:1.7 }}
              placeholder={`Start writing here...\n\nIntroduction: ${topic.structure?.introduction}\n\nBody: ${topic.structure?.body}\n\nConclusion: ${topic.structure?.conclusion}`}
              value={essay}
              onChange={e=>{ setEssay(e.target.value); setWordCount(countWords(e.target.value)); }}
            />
            {wordCount > 0 && wordCount < topic.minWords && (
              <Alert type="warn">⚠️ You need at least {topic.minWords} words. Currently: {wordCount} words.</Alert>
            )}
          </div>

          {draftSaved && <div style={{ textAlign:"center", fontSize:12, color:C.sage, marginBottom:8 }}>✓ Draft saved</div>}
          {busy && <Spinner label="Analysing your essay..."/>}
          <button style={{ ...S.btn(`linear-gradient(135deg,${C.purple},${C.coral})`), width:"100%", justifyContent:"center", padding:14 }}
            onClick={submitEssay} disabled={busy||wordCount<topic.minWords}>
            📤 Submit Essay for Analysis
          </button>
        </>}

        {/* STAGE: Evaluation + Resources */}
        {stage==="resources" && evaluation && <>
          <div style={{ ...S.card, marginBottom:16, background:"rgba(123,45,139,0.08)", border:`1px solid ${C.purple}44` }}>
            <h3 style={S.h3}>📊 First Draft Analysis</h3>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
              {Object.entries(evaluation.scores||{}).filter(([k])=>k!=="overall").map(([k,v])=>(
                <div key={k} style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:10, textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:800, color:v>=75?C.sage:v>=60?C.warn:C.error }}>{v}%</div>
                  <div style={{ fontSize:11, color:C.muted, textTransform:"capitalize" }}>{k}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:36, fontWeight:800, color:C.gold }}>{evaluation.scores?.overall}%</div>
                <Badge color={evaluation.grade==="A"?C.sage:evaluation.grade==="B"?C.teal:evaluation.grade==="C"?C.warn:C.error}>
                  Grade {evaluation.grade}
                </Badge>
              </div>
            </div>
            <p style={{ fontSize:14, color:C.sky, marginBottom:12 }}>{evaluation.summary}</p>
            {evaluation.strengths?.length>0 && <>
              <div style={{ fontWeight:700, color:C.sage, marginBottom:6 }}>💪 What you did well:</div>
              {evaluation.strengths.map((s,i)=><div key={i} style={{ fontSize:13, marginBottom:4 }}>✓ {s}</div>)}
            </>}
            {evaluation.improvements?.length>0 && <>
              <div style={{ fontWeight:700, color:C.gold, marginTop:12, marginBottom:6 }}>🎯 Areas to improve:</div>
              {evaluation.improvements.map((s,i)=><div key={i} style={{ fontSize:13, marginBottom:4 }}>→ {s}</div>)}
            </>}
            {evaluation.corrections?.length>0 && <>
              <div style={{ fontWeight:700, color:C.coral, marginTop:12, marginBottom:6 }}>✏️ Corrections:</div>
              {evaluation.corrections.map((c,i)=>(
                <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:8, padding:10, marginBottom:8, fontSize:13 }}>
                  <div style={{ color:C.error }}>✗ {c.original}</div>
                  <div style={{ color:C.sage }}>✓ {c.corrected}</div>
                  <div style={{ color:C.muted, marginTop:4 }}>{c.explanation}</div>
                </div>
              ))}
            </>}
            {evaluation.improvedVersion && (
              <div style={{ marginTop:12 }}>
                <div style={{ fontWeight:700, color:C.teal, marginBottom:6 }}>💡 Model paragraph example:</div>
                <div style={{ background:"rgba(0,180,216,0.08)", borderLeft:`3px solid ${C.teal}`, padding:"10px 14px", borderRadius:"0 8px 8px 0", fontSize:13, fontStyle:"italic" }}>{evaluation.improvedVersion}</div>
              </div>
            )}
          </div>

          {/* Resources */}
          <div style={{ ...S.card, marginBottom:16 }}>
            <h3 style={S.h3}>📚 Read These Resources First</h3>
            <p style={{ fontSize:14, color:C.sky, marginBottom:16 }}>Read about this topic, then come back to rewrite your essay with new knowledge. You have {topic?.reminderDays||2} days — we'll remind you!</p>
            {topic?.resources?.map((r,i)=>(
              <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:16, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{resourceIcons[r.type]||"📄"} {r.title}</div>
                  <Badge color={r.type==="wikipedia"?C.teal:r.type==="video"?C.coral:C.gold}>{r.type}</Badge>
                </div>
                <p style={{ fontSize:13, color:C.sky, marginBottom:10 }}>{r.description}</p>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(r.searchQuery)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ ...S.btn(`linear-gradient(135deg,${C.royal},${C.teal})`), padding:"6px 14px", fontSize:12, textDecoration:"none" }}>
                  🔍 Search: "{r.searchQuery}"
                </a>
              </div>
            ))}
          </div>

          <Alert type="info">⏰ A reminder notification will appear in {topic?.reminderDays||2} days to rewrite your essay. Make sure to allow notifications!</Alert>
          <button style={{ ...S.btn(`linear-gradient(135deg,${C.purple},${C.mint})`), width:"100%", justifyContent:"center", padding:14 }}
            onClick={()=>setStage("rewrite")}>
            ✅ I've Done My Reading — Rewrite Now
          </button>
        </>}

        {/* STAGE: Rewrite */}
        {stage==="rewrite" && <>
          {evaluation && (
            <div style={{ ...S.card, marginBottom:16, background:"rgba(0,180,216,0.06)" }}>
              <h3 style={S.h3}>📋 Reminder — Improve These Areas</h3>
              {evaluation.improvements?.map((s,i)=><div key={i} style={{ fontSize:13, marginBottom:4 }}>→ {s}</div>)}
            </div>
          )}
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <h3 style={{ ...S.h3, marginBottom:0 }}>✍️ Rewrite Your Essay</h3>
              <span style={{ fontSize:13, color:wordCount>=topic?.minWords?C.sage:C.warn }}>{countWords(rewriteEssay)} words</span>
            </div>
            <p style={{ fontSize:13, color:C.sky, marginBottom:10 }}>Now rewrite with everything you've learned. Show the improvement!</p>
            <textarea style={{ ...S.input, minHeight:280, resize:"vertical", lineHeight:1.7 }}
              placeholder="Rewrite your essay here with improved vocabulary, structure, and arguments..."
              value={rewriteEssay}
              onChange={e=>setRewriteEssay(e.target.value)}
            />
          </div>
          {busy && <Spinner label="Comparing your essays and analysing improvement..."/>}
          <button style={{ ...S.btn(`linear-gradient(135deg,${C.sage},${C.teal})`), width:"100%", justifyContent:"center", padding:14 }}
            onClick={submitRewrite} disabled={busy||countWords(rewriteEssay)<(topic?.minWords||100)}>
            🚀 Submit Rewrite for Final Analysis
          </button>
        </>}

        {/* STAGE: Final Result */}
        {stage==="result" && rewriteEval && <>
          <div style={{ ...S.card, marginBottom:16, textAlign:"center", background:"rgba(82,183,136,0.08)", border:`1px solid ${C.sage}44` }}>
            <div style={{ fontSize:48, marginBottom:8 }}>🏆</div>
            <h2 style={S.h2}>Essay Complete!</h2>
            <div style={{ display:"flex", justifyContent:"center", gap:24, marginBottom:12 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>First Draft</div>
                <div style={{ fontSize:28, fontWeight:800, color:C.warn }}>{evaluation?.scores?.overall}%</div>
                <Badge color={C.warn}>Grade {evaluation?.grade}</Badge>
              </div>
              <div style={{ fontSize:28, alignSelf:"center", color:C.sage }}>→</div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>After Research</div>
                <div style={{ fontSize:28, fontWeight:800, color:C.sage }}>{rewriteEval.scores?.overall}%</div>
                <Badge color={C.sage}>Grade {rewriteEval.grade}</Badge>
              </div>
            </div>
            {rewriteEval.improvementFromFirst && (
              <div style={{ background:"rgba(82,183,136,0.1)", borderRadius:10, padding:12, marginBottom:12, fontSize:14 }}>
                📈 {rewriteEval.improvementFromFirst}
              </div>
            )}
            <p style={{ color:C.sky }}>{rewriteEval.encouragement}</p>
          </div>

          <div style={{ ...S.card, marginBottom:16 }}>
            <h3 style={S.h3}>Final Essay Analysis</h3>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
              {Object.entries(rewriteEval.scores||{}).filter(([k])=>k!=="overall").map(([k,v])=>(
                <div key={k} style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:10, textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:v>=75?C.sage:v>=60?C.warn:C.error }}>{v}%</div>
                  <div style={{ fontSize:10, color:C.muted, textTransform:"capitalize" }}>{k}</div>
                </div>
              ))}
            </div>
            {rewriteEval.strengths?.length>0 && <>
              <div style={{ fontWeight:700, color:C.sage, marginBottom:6 }}>💪 Strengths:</div>
              {rewriteEval.strengths.map((s,i)=><div key={i} style={{ fontSize:13, marginBottom:4 }}>✓ {s}</div>)}
            </>}
            {rewriteEval.corrections?.length>0 && <>
              <div style={{ fontWeight:700, color:C.coral, marginTop:12, marginBottom:6 }}>✏️ Final corrections:</div>
              {rewriteEval.corrections.map((c,i)=>(
                <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:8, padding:10, marginBottom:8, fontSize:13 }}>
                  <div style={{ color:C.error }}>✗ {c.original}</div>
                  <div style={{ color:C.sage }}>✓ {c.corrected}</div>
                  <div style={{ color:C.muted, marginTop:4 }}>{c.explanation}</div>
                </div>
              ))}
            </>}
          </div>

          <button style={{ ...S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`), width:"100%", justifyContent:"center", padding:14 }}
            onClick={()=>{ loadTopic(); }}>
            ✨ Start a New Essay Topic
          </button>
        </>}
      </div>
    </div>
  );
}

// ── Lesson View ───────────────────────────────────────────────────────────────
function LessonView({ user, lessonNum, day, onDayComplete }) {
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const speech = useSpeech();
  const skill = SKILLS[(lessonNum-1)%SKILLS.length];
  const draftKey = `lesson_draft_${user.id}_${lessonNum}_${day}`;

  useEffect(()=>{
    (async()=>{
      setLoading(true); setLesson(null); setAnswers({}); setSubmitted(false); setFeedback(null);
      const result = await generateLesson(user.profile, lessonNum, day, skill);
      setLoading(false);
      setLesson(result.type==="lesson"?result:null);
      const saved = localStorage.getItem(`lesson_draft_${user.id}_${lessonNum}_${day}`);
      if (saved) { try { setAnswers(JSON.parse(saved)); } catch {} }
    })();
  },[lessonNum,day]);

  useEffect(()=>{
    if (!lesson || submitted || Object.keys(answers).length === 0) return;
    localStorage.setItem(draftKey, JSON.stringify(answers));
    setDraftSaved(true);
    const t = setTimeout(() => setDraftSaved(false), 2000);
    return () => clearTimeout(t);
  },[answers]);

  const checkAnswers = async () => {
    setEvalLoading(true);
    const kAnswers = lesson.exercises?.map((ex,i)=>({ q:ex.question, given:answers[i]||"", correct:ex.answer }));
    const result = await evaluateSubmission(user.profile, skill, { knowledge:kAnswers, writing:answers.writing, speaking:answers.speaking });
    setEvalLoading(false);
    setFeedback(result);
    setSubmitted(true);
    localStorage.removeItem(draftKey);
    await saveLesson(user.id, { lesson_num:lessonNum, day, answers, feedback:result, created_at:new Date().toISOString() });
  };

  if (loading) return <div style={{ padding:40 }}><Spinner label={`Generating Lesson ${lessonNum}...`}/></div>;
  if (!lesson) return <div style={{ padding:24 }}><Alert type="error">Could not load lesson. Please refresh.</Alert></div>;

  return (
    <div style={{ paddingBottom:80 }}>
      <div style={{ background:`linear-gradient(135deg,${C.royal},${C.navy})`, padding:"20px 24px", marginBottom:20 }}>
        <div style={{ maxWidth:720, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <Badge color={C.teal}>Lesson {lessonNum} — {skill}</Badge>
            <h2 style={{ ...S.h2, marginTop:8, marginBottom:0 }}>{lesson.title}</h2>
            <span style={{ fontSize:13, color:C.sky }}>Day {day} of 2 — {day===1?"📖 Learn":"✏️ Practice"}</span>
          </div>
          <Badge color={day===1?C.gold:C.coral}>{day===1?"Learn":"Practice"}</Badge>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"0 16px" }}>
        {/* Concept */}
        <div style={{ ...S.card, marginBottom:16 }}>
          <h3 style={S.h3}>📘 Today's Concept</h3>
          <p style={{ fontSize:15, lineHeight:1.7 }}>{lesson.explanation}</p>
          {lesson.examples?.length>0 && <>
            <div style={{ fontWeight:700, marginTop:12, marginBottom:6, color:C.sky }}>Examples:</div>
            {lesson.examples.map((ex,i)=><div key={i} style={{ background:"rgba(0,180,216,0.1)", borderLeft:`3px solid ${C.teal}`, padding:"8px 12px", marginBottom:6, borderRadius:"0 8px 8px 0", fontSize:14 }}>{ex}</div>)}
          </>}
        </div>

        {/* Vocabulary */}
        {lesson.vocabulary?.length>0 && (
          <div style={{ ...S.card, marginBottom:16 }}>
            <h3 style={S.h3}>📖 New Words</h3>
            {lesson.vocabulary.map((v,i)=>(
              <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:14, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontWeight:800, fontSize:17, color:C.gold }}>{v.word}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:13, color:C.muted }}>{v.phonetic}</span>
                    <SpeakButton text={v.word}/>
                  </div>
                </div>
                <div style={{ fontSize:14, color:C.sky, marginBottom:4 }}><strong>Meaning:</strong> {v.meaning}</div>
                <div style={{ fontSize:14, fontStyle:"italic" }}>{v.example}</div>
              </div>
            ))}
          </div>
        )}

        {/* Exercises */}
        {lesson.exercises?.length>0 && (
          <div style={{ ...S.card, marginBottom:16 }}>
            <h3 style={S.h3}>✏️ Exercises</h3>
            {lesson.exercises.map((ex,i)=>(
              <div key={i} style={{ marginBottom:18 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Q{i+1}. {ex.question}</div>
                {ex.type==="mcq"&&ex.options ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {ex.options.map((opt,j)=>{
                      const sel=answers[i]===opt, correct=submitted&&opt===ex.answer, wrong=submitted&&sel&&opt!==ex.answer;
                      return <label key={j} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, background:correct?`${C.sage}33`:wrong?`${C.error}33`:sel?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.04)", cursor:"pointer", fontSize:14, border:`1px solid ${correct?C.sage:wrong?C.error:"transparent"}` }}>
                        <input type="radio" name={`q${i}`} value={opt} checked={sel} onChange={()=>!submitted&&setAnswers({...answers,[i]:opt})} style={{ accentColor:C.teal }}/>
                        {opt}
                      </label>;
                    })}
                  </div>
                ) : (
                  <input style={S.input} placeholder="Your answer..." value={answers[i]||""} onChange={e=>setAnswers({...answers,[i]:e.target.value})} disabled={submitted}/>
                )}
                {submitted && <div style={{ fontSize:12, color:C.sky, marginTop:4 }}>💡 {ex.hint}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Writing */}
        <div style={{ ...S.card, marginBottom:16 }}>
          <h3 style={S.h3}>✍️ Writing Practice</h3>
          <p style={{ fontSize:14, color:C.sky, marginBottom:10 }}>Write a short paragraph using at least 2 of today's words and the concept you learned.</p>
          <textarea style={{ ...S.input, minHeight:120, resize:"vertical" }} placeholder="Start writing here..." value={answers.writing||""} onChange={e=>setAnswers({...answers,writing:e.target.value})} disabled={submitted}/>
        </div>

        {/* Read Aloud */}
        {lesson.readAloudPassage && (
          <div style={{ ...S.card, marginBottom:16 }}>
            <h3 style={S.h3}>🎤 Read Aloud</h3>
            <div style={{ background:"rgba(0,180,216,0.08)", borderRadius:10, padding:16, marginBottom:14, fontSize:15, lineHeight:1.8, fontStyle:"italic" }}>{lesson.readAloudPassage}</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10 }}>
              <SpeakButton text={lesson.readAloudPassage}/>
              {!speech.listening
                ? <button style={S.btn(C.coral)} onClick={()=>{speech.reset();speech.start();}}>🎙 Start Recording</button>
                : <button style={S.btn(C.error)} onClick={speech.stop}>⏹ Stop</button>}
              {speech.listening && <span style={{ fontSize:13, color:C.warn, alignSelf:"center" }}>● Listening...</span>}
            </div>
            {speech.error && <Alert type="warn">⚠️ {speech.error} — Type below instead.</Alert>}
            {speech.transcript && <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:8, padding:10, fontSize:14, marginBottom:8 }}>📝 Heard: "{speech.transcript}"</div>}
            <textarea style={{ ...S.input, minHeight:80, resize:"vertical" }} placeholder="Speaking transcript..." value={answers.speaking||speech.transcript} onChange={e=>setAnswers({...answers,speaking:e.target.value})} disabled={submitted}/>
          </div>
        )}

        {/* Feedback */}
        {submitted && feedback?.type==="evaluation" && (
          <div style={{ ...S.card, marginBottom:16, background:"rgba(82,183,136,0.06)" }}>
            <h3 style={S.h3}>📊 Feedback</h3>
            {feedback.scores && Object.entries(feedback.scores).filter(([k])=>k!=="total").map(([k,v])=><ScoreBar key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} score={v}/>)}
            {feedback.feedback?.corrections?.length>0 && <>
              <div style={{ fontWeight:700, color:C.coral, marginTop:12, marginBottom:6 }}>✏️ Corrections</div>
              {feedback.feedback.corrections.map((c,i)=>(
                <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:8, padding:10, marginBottom:8, fontSize:13 }}>
                  <div style={{ color:C.error }}>✗ {c.original}</div>
                  <div style={{ color:C.sage }}>✓ {c.corrected}</div>
                  <div style={{ color:C.muted, marginTop:4 }}>{c.explanation}</div>
                </div>
              ))}
            </>}
            <p style={{ color:C.sky, fontStyle:"italic", marginTop:12 }}>{feedback.encouragement}</p>
          </div>
        )}

        {draftSaved && <div style={{ textAlign:"center", fontSize:12, color:C.sage, marginBottom:8 }}>✓ Draft saved</div>}
        {evalLoading && <Spinner label="Getting your feedback..."/>}
        {!submitted ? (
          <button style={{ ...S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`), width:"100%", justifyContent:"center", padding:14 }} onClick={checkAnswers} disabled={evalLoading}>
            ✅ Submit & Get Feedback
          </button>
        ) : (
          <button style={{ ...S.btn(`linear-gradient(135deg,${C.gold},${C.coral})`), width:"100%", justifyContent:"center", padding:14 }} onClick={()=>onDayComplete(answers,feedback)}>
            {day===1?"Continue to Day 2 →":"🎯 Take the Test!"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Test View ─────────────────────────────────────────────────────────────────
function TestView({ user, lessonNum, attemptNum=1, onResult }) {
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const speech = useSpeech();
  const skill = SKILLS[(lessonNum-1)%SKILLS.length];
  const draftKey = `test_draft_${user.id}_${lessonNum}_${attemptNum}`;

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const r = await generateTest(user.profile, lessonNum, attemptNum, skill);
      setLoading(false);
      setTest(r.type==="test"?r:null);
      const saved = localStorage.getItem(`test_draft_${user.id}_${lessonNum}_${attemptNum}`);
      if (saved) { try { setAnswers(JSON.parse(saved)); } catch {} }
    })();
  },[lessonNum,attemptNum]);

  useEffect(()=>{
    if (!test || submitted || Object.keys(answers).length === 0) return;
    localStorage.setItem(draftKey, JSON.stringify(answers));
    setDraftSaved(true);
    const t = setTimeout(() => setDraftSaved(false), 2000);
    return () => clearTimeout(t);
  },[answers]);

  const submit = async () => {
    setSubmitting(true);
    const sec = test.sections;
    const kAnswers = sec.knowledge?.map((q,i)=>({ q:q.question, given:answers[`k${i}`]||"", correct:q.answer }));
    const aAnswers = sec.application?.map((q,i)=>({ q:q.question, given:answers[`a${i}`]||"", correct:q.answer }));
    const ev = await evaluateSubmission(user.profile, skill, { knowledge:kAnswers, application:aAnswers, writing:answers.writing, speaking:answers.speaking }, true);
    const record = { lesson_num:lessonNum, skill, attempt_num:attemptNum, scores:ev.scores, passed:ev.passed, answers, feedback:ev.feedback, created_at:new Date().toISOString() };
    await saveTest(user.id, record);
    localStorage.removeItem(draftKey);
    setResult(ev); setSubmitted(true); setSubmitting(false);
  };

  if (loading) return <div style={{ padding:40 }}><Spinner label={`Generating Test for Lesson ${lessonNum}...`}/></div>;
  if (!test) return <div style={{ padding:24 }}><Alert type="error">Could not load test. Please refresh.</Alert></div>;
  const sec = test.sections;

  return (
    <div style={{ paddingBottom:80 }}>
      <div style={{ background:`linear-gradient(135deg,${C.royal},${C.ink})`, padding:"20px 24px", marginBottom:20 }}>
        <div style={{ maxWidth:720, margin:"0 auto" }}>
          <Badge color={C.coral}>📝 TEST — Day 3</Badge>
          <h2 style={{ ...S.h2, marginTop:8, marginBottom:0 }}>Lesson {lessonNum}: {skill} Test</h2>
          <p style={{ fontSize:13, color:C.sky, marginTop:4 }}>Attempt {attemptNum} · Passing score: 75% overall, no section below 60%</p>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"0 16px" }}>
        {!submitted ? <>
          {/* Section A */}
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
              <h3 style={S.h3}>Section A — Knowledge</h3><Badge color={C.teal}>25%</Badge>
            </div>
            {sec.knowledge?.map((q,i)=>(
              <div key={i} style={{ marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Q{i+1}. {q.question}</div>
                {q.options?.map((opt,j)=>(
                  <label key={j} style={{ display:"flex", gap:10, padding:"8px 12px", borderRadius:8, background:answers[`k${i}`]===opt?"rgba(0,180,216,0.15)":"rgba(255,255,255,0.04)", cursor:"pointer", fontSize:14, marginBottom:4, border:`1px solid ${answers[`k${i}`]===opt?C.teal:"transparent"}` }}>
                    <input type="radio" name={`k${i}`} value={opt} checked={answers[`k${i}`]===opt} onChange={()=>setAnswers({...answers,[`k${i}`]:opt})} style={{ accentColor:C.teal }}/>
                    {opt}
                  </label>
                ))}
              </div>
            ))}
          </div>

          {/* Section B */}
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
              <h3 style={S.h3}>Section B — Application</h3><Badge color={C.gold}>35%</Badge>
            </div>
            {sec.application?.map((q,i)=>(
              <div key={i} style={{ marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Q{i+1}. {q.question}</div>
                <input style={S.input} placeholder="Your answer..." value={answers[`a${i}`]||""} onChange={e=>setAnswers({...answers,[`a${i}`]:e.target.value})}/>
              </div>
            ))}
          </div>

          {/* Section C */}
          {sec.writing && (
            <div style={{ ...S.card, marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <h3 style={S.h3}>Section C — Writing</h3><Badge color={C.coral}>25%</Badge>
              </div>
              <div style={{ background:"rgba(244,162,97,0.1)", borderRadius:10, padding:14, marginBottom:10, fontSize:15 }}>{sec.writing.prompt}</div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Min {sec.writing.minWords} words · {sec.writing.criteria?.join(", ")}</div>
              <textarea style={{ ...S.input, minHeight:150, resize:"vertical" }} value={answers.writing||""} onChange={e=>setAnswers({...answers,writing:e.target.value})} placeholder="Write here..."/>
            </div>
          )}

          {/* Section D */}
          {sec.speaking && (
            <div style={{ ...S.card, marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <h3 style={S.h3}>Section D — Speaking</h3><Badge color={C.mint}>15%</Badge>
              </div>
              <div style={{ background:"rgba(0,180,216,0.08)", borderRadius:10, padding:14, marginBottom:10, fontSize:15, fontStyle:"italic", lineHeight:1.8 }}>{sec.speaking.passage}</div>
              <div style={{ marginBottom:10 }}><SpeakButton text={sec.speaking.passage}/></div>
              <div style={{ background:"rgba(244,162,97,0.1)", borderRadius:10, padding:12, marginBottom:12, fontSize:14 }}>🗣 {sec.speaking.prompt}</div>
              <div style={{ display:"flex", gap:10, marginBottom:10, flexWrap:"wrap" }}>
                {!speech.listening
                  ? <button style={S.btn(C.coral)} onClick={()=>{speech.reset();speech.start();}}>🎙 Record</button>
                  : <button style={S.btn(C.error)} onClick={speech.stop}>⏹ Stop</button>}
                {speech.listening && <span style={{ color:C.warn, fontSize:13, alignSelf:"center" }}>● Listening...</span>}
              </div>
              {speech.error && <Alert type="warn">⚠️ {speech.error}</Alert>}
              {speech.transcript && <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:8, padding:10, fontSize:14, marginBottom:8 }}>"{speech.transcript}"</div>}
              <textarea style={{ ...S.input, minHeight:80 }} placeholder="Speaking transcript..." value={answers.speaking||speech.transcript} onChange={e=>setAnswers({...answers,speaking:e.target.value})}/>
            </div>
          )}

          {draftSaved && <div style={{ textAlign:"center", fontSize:12, color:C.sage, marginBottom:8 }}>✓ Draft saved</div>}
          {submitting && <Spinner label="Evaluating your test..."/>}
          <button style={{ ...S.btn(`linear-gradient(135deg,${C.coral},${C.error})`), width:"100%", justifyContent:"center", padding:14 }} onClick={submit} disabled={submitting}>
            📤 Submit Test
          </button>
        </> : result && (
          <div>
            <div style={{ ...S.card, marginBottom:16, textAlign:"center", background:result.passed?"rgba(82,183,136,0.1)":"rgba(230,57,70,0.1)" }}>
              <div style={{ fontSize:48, marginBottom:8 }}>{result.passed?"🎉":"💪"}</div>
              <h2 style={{ ...S.h2, color:result.passed?C.sage:C.coral }}>{result.passed?"You Passed!":"Keep Going!"}</h2>
              <div style={{ fontSize:36, fontWeight:800, color:result.passed?C.sage:C.warn }}>{result.scores?.total||0}%</div>
              <p style={{ color:C.sky, marginTop:8 }}>{result.encouragement}</p>
            </div>
            <div style={{ ...S.card, marginBottom:16 }}>
              <h3 style={S.h3}>Score Breakdown</h3>
              {result.scores && Object.entries(result.scores).filter(([k])=>k!=="total").map(([k,v])=><ScoreBar key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} score={v}/>)}
            </div>
            {result.feedback?.corrections?.length>0 && (
              <div style={{ ...S.card, marginBottom:16 }}>
                <h3 style={S.h3}>✏️ Corrections</h3>
                {result.feedback.corrections.map((c,i)=>(
                  <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:8, padding:10, marginBottom:8, fontSize:13 }}>
                    <div style={{ color:C.error }}>✗ {c.original}</div>
                    <div style={{ color:C.sage }}>✓ {c.corrected}</div>
                    <div style={{ color:C.muted, marginTop:4 }}>{c.explanation}</div>
                  </div>
                ))}
              </div>
            )}
            <button style={{ ...S.btn(result.passed?`linear-gradient(135deg,${C.sage},${C.teal})`:`linear-gradient(135deg,${C.gold},${C.coral})`), width:"100%", justifyContent:"center", padding:14 }} onClick={()=>onResult(result)}>
              {result.passed?"🚀 Unlock Next Lesson →":"🔄 Extend & Retry"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ user, onStartLesson, onViewHistory, onEssay }) {
  const p = user.profile;
  const tests = user.tests||[];
  const essays = user.essays||[];
  const lessonNum = user.current_lesson||1;
  const day = user.current_day||1;
  const skill = SKILLS[(lessonNum-1)%SKILLS.length];
  const avgScore = tests.length ? Math.round(tests.reduce((s,t)=>s+(t.scores?.total||0),0)/tests.length) : null;
  const passed = tests.filter(t=>t.passed).length;
  const pendingEssay = essays.find(e=>e.status==="pending_rewrite");

  return (
    <div style={{ paddingBottom:80 }}>
      <div style={{ background:`linear-gradient(135deg,${C.royal},${C.navy})`, padding:"24px", marginBottom:20 }}>
        <div style={{ maxWidth:720, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <p style={{ color:C.sky, margin:"0 0 4px", fontSize:13 }}>Welcome back,</p>
            <h1 style={{ ...S.h1, margin:0 }}>{p?.name||user.username} 👋</h1>
            <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
              <Badge color={C.teal}>{p?.level||"Beginner"}</Badge>
              <Badge color={p?.type==="student"?C.gold:C.coral}>{p?.type==="student"?`Grade ${p.grade}`:p?.career||"Learner"}</Badge>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:28, fontWeight:800, color:C.gold }}>{user.streak||0} 🔥</div>
            <div style={{ fontSize:12, color:C.sky }}>Day Streak</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"0 16px" }}>

        {/* Pending essay reminder */}
        {pendingEssay && (
          <div style={{ background:`linear-gradient(135deg,${C.purple}44,${C.navy})`, border:`1px solid ${C.purple}66`, borderRadius:16, padding:20, marginBottom:20 }}>
            <div style={{ fontSize:12, color:C.sky, marginBottom:4 }}>✍️ ESSAY REWRITE DUE</div>
            <h3 style={{ ...S.h3, marginBottom:6 }}>{pendingEssay.topic_data?.title}</h3>
            <p style={{ fontSize:13, color:C.sky, marginBottom:12 }}>You've done your reading — time to rewrite and show your improvement!</p>
            <button style={S.btn(`linear-gradient(135deg,${C.purple},${C.coral})`)} onClick={onEssay}>✍️ Rewrite My Essay →</button>
          </div>
        )}

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
          {[["📚",lessonNum-1,"Lessons"],["✅",passed,"Passed"],["📊",avgScore!==null?`${avgScore}%`:"—","Avg Score"],["✍️",essays.filter(e=>e.status==="completed").length,"Essays Done"]].map(([icon,val,label])=>(
            <div key={label} style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:20, fontWeight:800, color:C.gold }}>{val}</div>
              <div style={{ fontSize:11, color:C.sky }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Next lesson */}
        <div style={{ background:`linear-gradient(135deg,${C.royal}cc,${C.teal}22)`, border:`1px solid ${C.teal}44`, borderRadius:16, padding:24, marginBottom:16 }}>
          <div style={{ fontSize:12, color:C.sky, marginBottom:6 }}>UP NEXT</div>
          <h2 style={{ ...S.h2, marginBottom:4 }}>{day<=2?`Lesson ${lessonNum}: ${skill}`:`Test — Lesson ${lessonNum}`}</h2>
          <p style={{ color:C.sky, fontSize:14, marginBottom:16 }}>
            {day===1?"📖 Day 1 — Learn the concept":day===2?"✏️ Day 2 — Practice exercises":"📝 Day 3 — Take the test!"}
          </p>
          <button style={S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`)} onClick={onStartLesson}>
            {day<=2?"Start Lesson →":"Take Test →"}
          </button>
        </div>

        {/* Essay button */}
        {p?.type==="student" && (
          <div style={{ background:`linear-gradient(135deg,${C.purple}33,${C.navy})`, border:`1px solid ${C.purple}44`, borderRadius:16, padding:24, marginBottom:20 }}>
            <div style={{ fontSize:12, color:C.sky, marginBottom:6 }}>✍️ ESSAY WRITING</div>
            <h2 style={{ ...S.h2, marginBottom:4 }}>Practice Essay Writing</h2>
            <p style={{ color:C.sky, fontSize:14, marginBottom:16 }}>Get a topic, write, research, rewrite — and watch your writing improve!</p>
            <button style={S.btn(`linear-gradient(135deg,${C.purple},${C.coral})`)} onClick={onEssay}>✍️ Start Essay →</button>
          </div>
        )}
        {p?.type==="adult" && (
          <div style={{ background:`linear-gradient(135deg,${C.purple}33,${C.navy})`, border:`1px solid ${C.purple}44`, borderRadius:16, padding:24, marginBottom:20 }}>
            <div style={{ fontSize:12, color:C.sky, marginBottom:6 }}>✍️ PROFESSIONAL WRITING</div>
            <h2 style={{ ...S.h2, marginBottom:4 }}>Career Writing Practice</h2>
            <p style={{ color:C.sky, fontSize:14, marginBottom:16 }}>Write reports, proposals and professional documents for your career goals.</p>
            <button style={S.btn(`linear-gradient(135deg,${C.purple},${C.coral})`)} onClick={onEssay}>✍️ Start Writing →</button>
          </div>
        )}

        {/* Curriculum map */}
        <div style={{ ...S.card, marginBottom:20 }}>
          <h3 style={S.h3}>🗺 Your Journey</h3>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:12 }}>
            {Array.from({length:14},(_,i)=>i+1).map(ln=>{
              const s=SKILLS[(ln-1)%SKILLS.length];
              const done=ln<lessonNum, current=ln===lessonNum, locked=ln>lessonNum;
              return (
                <div key={ln} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:done?C.sage:current?C.teal:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, border:current?`2px solid ${C.gold}`:"2px solid transparent" }}>
                    {done?"✓":locked?"🔒":"▶"}
                  </div>
                  <div style={{ fontSize:9, color:current?C.gold:done?C.sage:C.muted, textAlign:"center", maxWidth:44 }}>{s.slice(0,7)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent tests */}
        {tests.length>0 && (
          <div style={{ ...S.card, marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <h3 style={{ ...S.h3, marginBottom:0 }}>📋 Recent Tests</h3>
            </div>
            {tests.slice(-3).reverse().map((t,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>Lesson {t.lesson_num} — {t.skill}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontWeight:700, color:t.passed?C.sage:C.coral }}>{t.scores?.total||0}%</span>
                  <Badge color={t.passed?C.sage:C.error}>{t.passed?"PASS":"RETRY"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────
function HistoryView({ user }) {
  const [tab, setTab] = useState("tests");
  const [expandedLessons, setExpandedLessons] = useState({});
  const tests = (user.tests||[]).slice().reverse();
  const essays = (user.essays||[]).slice().reverse();
  const lessons = (user.lessons||[]).slice();

  const toggleLesson = (i) => setExpandedLessons(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 16px 80px" }}>
      <h2 style={S.h2}>📋 My History</h2>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {[["tests","📝 Tests"],["lessons","📖 Lessons"],["essays","✍️ Essays"]].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)} style={{ ...S.btn(tab===key?`rgba(0,180,216,0.2)`:"rgba(255,255,255,0.06)"), border:tab===key?`1px solid ${C.teal}44`:"1px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {tab==="tests" && (tests.length===0 ? <Alert type="info">No tests yet!</Alert> : tests.map((t,i)=>(
        <div key={i} style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
            <div>
              <div style={{ fontWeight:700 }}>Lesson {t.lesson_num} — {t.skill}</div>
              <div style={{ fontSize:12, color:C.muted }}>{new Date(t.created_at).toLocaleString()} · Attempt {t.attempt_num}</div>
            </div>
            <Badge color={t.passed?C.sage:C.error}>{t.passed?"✓ PASSED":"✗ RETRY"}</Badge>
          </div>
          {t.scores && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {Object.entries(t.scores).filter(([k])=>k!=="total").map(([k,v])=>(
                <div key={k} style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:8, textAlign:"center" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:v>=75?C.sage:v>=60?C.warn:C.error }}>{v}%</div>
                  <div style={{ fontSize:10, color:C.muted, textTransform:"capitalize" }}>{k}</div>
                </div>
              ))}
            </div>
          )}
          {t.answers?.writing && <div style={{ marginTop:10, fontSize:13, color:C.sky, fontStyle:"italic", background:"rgba(255,255,255,0.03)", borderRadius:8, padding:10 }}>"{t.answers.writing.slice(0,150)}..."</div>}
        </div>
      )))}

      {tab==="lessons" && (lessons.length===0 ? <Alert type="info">No completed lessons yet — start learning!</Alert> : lessons.map((l,i)=>{
        const skill = l.skill || SKILLS[((l.lesson_num||1)-1)%SKILLS.length];
        const expanded = !!expandedLessons[i];
        const totalScore = l.feedback?.scores?.total ?? l.feedback?.scores?.knowledge ?? null;
        return (
          <div key={i} style={{ ...S.card, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, marginBottom:2 }}>Lesson {l.lesson_num} — {skill}</div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>
                  {l.day===1?"📖 Day 1 — Learn":"✏️ Day 2 — Practice"} · {new Date(l.created_at).toLocaleString()}
                </div>
                {totalScore !== null && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:totalScore>=75?C.sage:totalScore>=60?C.warn:C.coral }}>{totalScore}%</span>
                    <span style={{ fontSize:11, color:C.muted }}>overall</span>
                  </div>
                )}
              </div>
              <button onClick={()=>toggleLesson(i)} style={{ ...S.btn("rgba(255,255,255,0.06)"), padding:"4px 10px", fontSize:12, border:"1px solid rgba(255,255,255,0.1)", marginLeft:10, flexShrink:0 }}>
                {expanded?"▲ Hide":"▼ Show"}
              </button>
            </div>

            {expanded && (
              <div style={{ marginTop:14, borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:14 }}>
                {/* Exercise answers */}
                {l.answers && Object.keys(l.answers).filter(k=>k!=="writing"&&k!=="speaking").length>0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.sky, marginBottom:6 }}>Exercise Answers</div>
                    {Object.entries(l.answers).filter(([k])=>k!=="writing"&&k!=="speaking").map(([k,v])=>(
                      <div key={k} style={{ fontSize:12, background:"rgba(255,255,255,0.03)", borderRadius:6, padding:"6px 10px", marginBottom:4 }}>
                        <span style={{ color:C.muted }}>Q{Number(k)+1}: </span>{v}
                      </div>
                    ))}
                  </div>
                )}

                {/* Writing */}
                {l.answers?.writing && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.sky, marginBottom:6 }}>✍️ Writing Response</div>
                    <div style={{ fontSize:13, fontStyle:"italic", background:"rgba(255,255,255,0.03)", borderRadius:8, padding:10, lineHeight:1.6 }}>{l.answers.writing}</div>
                  </div>
                )}

                {/* Speaking */}
                {l.answers?.speaking && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.sky, marginBottom:6 }}>🎤 Speaking Transcript</div>
                    <div style={{ fontSize:13, fontStyle:"italic", background:"rgba(255,255,255,0.03)", borderRadius:8, padding:10, lineHeight:1.6 }}>{l.answers.speaking}</div>
                  </div>
                )}

                {/* Feedback */}
                {l.feedback?.type==="evaluation" && (
                  <div>
                    {l.feedback.feedback?.strengths?.length>0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.sage, marginBottom:4 }}>Strengths</div>
                        {l.feedback.feedback.strengths.map((s,j)=><div key={j} style={{ fontSize:12, color:C.sky, marginBottom:2 }}>• {s}</div>)}
                      </div>
                    )}
                    {l.feedback.feedback?.improvements?.length>0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.warn, marginBottom:4 }}>Areas to Improve</div>
                        {l.feedback.feedback.improvements.map((s,j)=><div key={j} style={{ fontSize:12, color:C.sky, marginBottom:2 }}>• {s}</div>)}
                      </div>
                    )}
                    {l.feedback.feedback?.corrections?.length>0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.coral, marginBottom:6 }}>Corrections</div>
                        {l.feedback.feedback.corrections.map((c,j)=>(
                          <div key={j} style={{ fontSize:12, background:"rgba(255,255,255,0.04)", borderRadius:6, padding:"6px 10px", marginBottom:4 }}>
                            <div style={{ color:C.error }}>✗ {c.original}</div>
                            <div style={{ color:C.sage }}>✓ {c.corrected}</div>
                            <div style={{ color:C.muted, marginTop:2 }}>{c.explanation}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {l.feedback.encouragement && (
                      <div style={{ fontSize:13, fontStyle:"italic", color:C.gold, background:"rgba(255,200,0,0.06)", borderRadius:8, padding:10 }}>
                        {l.feedback.encouragement}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }))}

      {tab==="essays" && (essays.length===0 ? <Alert type="info">No essays yet — start one from the dashboard!</Alert> : essays.map((e,i)=>(
        <div key={i} style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontWeight:700 }}>{e.topic_data?.title||"Essay"}</div>
            <Badge color={e.status==="completed"?C.sage:C.warn}>{e.status==="completed"?"✓ Complete":"⏳ Rewrite Due"}</Badge>
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{new Date(e.created_at).toLocaleString()}</div>
          <div style={{ display:"flex", gap:12 }}>
            {e.first_evaluation && (
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.muted }}>First Draft</div>
                <div style={{ fontWeight:800, color:C.warn }}>{e.first_evaluation.scores?.overall}% / Grade {e.first_evaluation.grade}</div>
              </div>
            )}
            {e.rewrite_evaluation && <>
              <div style={{ color:C.sage, alignSelf:"center" }}>→</div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.muted }}>After Research</div>
                <div style={{ fontWeight:800, color:C.sage }}>{e.rewrite_evaluation.scores?.overall}% / Grade {e.rewrite_evaluation.grade}</div>
              </div>
            </>}
          </div>
          {e.first_essay && <div style={{ marginTop:10, fontSize:13, fontStyle:"italic", color:C.sky, background:"rgba(255,255,255,0.03)", borderRadius:8, padding:10 }}>"{e.first_essay.slice(0,150)}..."</div>}
        </div>
      )))}
    </div>
  );
}

// ── Admin ─────────────────────────────────────────────────────────────────────
function AdminView({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(()=>{ getAllUsers().then(u=>{ setUsers(u); setLoading(false); }); },[]);

  if (loading) return <div style={{ padding:40 }}><Spinner label="Loading all users..."/></div>;

  const flagged = users.filter(u=>(u.tests||[]).filter(t=>!t.passed).length>=2);

  if (selected) {
    const u = users.find(x=>x.id===selected);
    return (
      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 16px 80px" }}>
        <button onClick={()=>setSelected(null)} style={{ ...S.btn("rgba(255,255,255,0.1)"), marginBottom:16 }}>← All Users</button>
        <div style={{ ...S.card, marginBottom:16 }}>
          <h2 style={S.h2}>{u.profile?.name||u.username}</h2>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            <Badge color={C.teal}>{u.profile?.level||"Unassessed"}</Badge>
            <Badge color={C.gold}>{u.profile?.type||"Unknown"}</Badge>
            {u.profile?.grade && <Badge color={C.coral}>Grade {u.profile.grade}</Badge>}
            {u.profile?.career && <Badge color={C.mint}>{u.profile.career}</Badge>}
          </div>
          <div style={{ fontSize:13, color:C.sky }}>Lesson {u.current_lesson||1} · Day {u.current_day||1} · {(u.lessons||[]).length} lessons · {(u.tests||[]).length} tests · {(u.essays||[]).length} essays · Streak {u.streak||0} 🔥</div>
          {u.email && <div style={{ fontSize:12, marginTop:4, color:C.muted }}>📧 {u.email}</div>}
        </div>

        <h3 style={S.h3}>Tests ({(u.tests||[]).length})</h3>
        {(u.tests||[]).length===0 ? <Alert type="info">No tests.</Alert> : (u.tests||[]).slice().reverse().map((t,i)=>(
          <div key={i} style={{ ...S.card, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div><strong>Lesson {t.lesson_num}</strong> — {t.skill}</div>
              <Badge color={t.passed?C.sage:C.error}>{t.scores?.total||0}%</Badge>
            </div>
            <div style={{ fontSize:12, color:C.muted }}>{new Date(t.created_at).toLocaleString()}</div>
            {t.answers?.writing && <div style={{ marginTop:6, fontSize:12, fontStyle:"italic", color:C.sky }}>"{t.answers.writing.slice(0,100)}..."</div>}
          </div>
        ))}

        <h3 style={{ ...S.h3, marginTop:20 }}>Lessons ({(u.lessons||[]).length})</h3>
        {(u.lessons||[]).length===0 ? <Alert type="info">No lessons.</Alert> : (u.lessons||[]).map((l,i)=>{
          const skill = l.skill || SKILLS[((l.lesson_num||1)-1)%SKILLS.length];
          const totalScore = l.feedback?.scores?.total ?? l.feedback?.scores?.knowledge ?? null;
          return (
            <div key={i} style={{ ...S.card, marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <div><strong>Lesson {l.lesson_num}</strong> — {skill}</div>
                {totalScore !== null && <Badge color={totalScore>=75?C.sage:totalScore>=60?C.warn:C.error}>{totalScore}%</Badge>}
              </div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>
                {l.day===1?"📖 Day 1 — Learn":"✏️ Day 2 — Practice"} · {new Date(l.created_at).toLocaleString()}
              </div>
              {l.answers?.writing && <div style={{ fontSize:12, fontStyle:"italic", color:C.sky }}>"{l.answers.writing.slice(0,100)}..."</div>}
              {l.feedback?.feedback?.strengths?.length>0 && <div style={{ fontSize:11, color:C.sage, marginTop:4 }}>✓ {l.feedback.feedback.strengths[0]}</div>}
            </div>
          );
        })}

        <h3 style={{ ...S.h3, marginTop:20 }}>Essays ({(u.essays||[]).length})</h3>
        {(u.essays||[]).length===0 ? <Alert type="info">No essays.</Alert> : (u.essays||[]).map((e,i)=>(
          <div key={i} style={{ ...S.card, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{e.topic_data?.title}</div>
              <Badge color={e.status==="completed"?C.sage:C.warn}>{e.status}</Badge>
            </div>
            {e.first_evaluation && <div style={{ fontSize:13 }}>First: {e.first_evaluation.scores?.overall}% (Grade {e.first_evaluation.grade})</div>}
            {e.rewrite_evaluation && <div style={{ fontSize:13, color:C.sage }}>Rewrite: {e.rewrite_evaluation.scores?.overall}% (Grade {e.rewrite_evaluation.grade})</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 16px 80px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ ...S.h2, marginBottom:0 }}>🔐 Admin Dashboard</h2>
        <button onClick={onBack} style={S.btn("rgba(255,255,255,0.1)")}>Exit</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {[["👥",users.length,"Users"],["✅",users.filter(u=>(u.tests||[]).some(t=>t.passed)).length,"Active"],["⚠️",flagged.length,"Need Help"]].map(([icon,val,label])=>(
          <div key={label} style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:24 }}>{icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:C.gold }}>{val}</div>
            <div style={{ fontSize:11, color:C.sky }}>{label}</div>
          </div>
        ))}
      </div>
      {flagged.length>0 && <Alert type="warn">⚠️ {flagged.length} user(s) failing multiple tests — may need support.</Alert>}
      {users.map(u=>{
        const tests=u.tests||[], avg=tests.length?Math.round(tests.reduce((s,t)=>s+(t.scores?.total||0),0)/tests.length):null;
        const stuck=flagged.find(f=>f.id===u.id);
        return (
          <div key={u.id} onClick={()=>setSelected(u.id)} style={{ ...S.card, marginBottom:10, cursor:"pointer", border:`1px solid ${stuck?C.warn+"44":"rgba(255,255,255,0.1)"}` }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontWeight:700 }}>{u.profile?.name||u.username} {stuck&&"⚠️"}</div>
                <div style={{ fontSize:12, color:C.muted }}>{u.email} · {u.profile?.type||"No profile"} · L{u.current_lesson||1}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                {avg!==null && <div style={{ fontWeight:700, color:avg>=75?C.sage:C.warn }}>{avg}%</div>}
                <div style={{ fontSize:11, color:C.muted }}>{(u.lessons||[]).length} lessons · {tests.length} tests · {(u.essays||[]).length} essays</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const didLoginRef = useRef(false);

  useEffect(()=>{
    let sub;
    onAuthChange(async u => {
      setAuthLoading(false);
      if (u) {
        setUser(u);
        if (didLoginRef.current) {
          setScreen(u.profile ? "dashboard" : "setup");
          didLoginRef.current = false;
        }
      } else {
        setUser(null);
        setScreen("landing");
      }
    }).then(s=>{ sub=s; });
    return ()=>{ sub?.unsubscribe(); };
  },[]);

  const handleLogin = (u) => {
    didLoginRef.current = true;
    setUser(u);
    setScreen(u.profile ? "dashboard" : "setup");
  };
  const handleLogout = async () => {
    didLoginRef.current = false;
    await logoutUser();
    setUser(null);
    setScreen("landing");
  };

  const handleDayComplete = async (answers, feedback) => {
    const newDay = await advanceDay(user.id);
    const fresh = await getUserData(user.id);
    setUser(fresh);
    setScreen(newDay<=2?"lesson":"test");
  };

  const handleTestResult = async (result) => {
    const fresh = await advanceLesson(user.id, result.passed);
    setUser(fresh);
    setScreen("dashboard");
  };

  const lessonNum = user?.current_lesson||1;
  const day = user?.current_day||1;
  const attemptNum = (user?.tests||[]).filter(t=>t.lesson_num===lessonNum).length+1;
  const nav = s => setScreen(s);

  return (
    <div style={S.app}>
      {/* Nav */}
      {user && !["setup","landing"].includes(screen) && (
        <div style={{ position:"sticky", top:0, zIndex:100, background:"rgba(22,33,62,0.95)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontWeight:800, fontSize:17, background:`linear-gradient(90deg,${C.sky},${C.gold})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>📚 VocabMentor</div>
            {user?.username && <span style={{ fontSize:12, color:C.sky, background:"rgba(255,255,255,0.08)", padding:"3px 10px", borderRadius:20 }}>👤 {user.username}</span>}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {[["dashboard","🏠"],["history","📋"],["essay","✍️"]].map(([s,icon])=>(
              <button key={s} onClick={()=>nav(s)} style={{ ...S.btn(screen===s?"rgba(0,180,216,0.2)":"rgba(255,255,255,0.06)"), padding:"6px 12px", fontSize:12, border:screen===s?`1px solid ${C.teal}44`:"1px solid transparent" }}>
                {icon} {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
            <button onClick={handleLogout} style={{ ...S.btn("rgba(255,255,255,0.06)"), padding:"6px 12px", fontSize:12 }}>Sign Out</button>
          </div>
        </div>
      )}

      {screen==="landing" && <LandingPage onLogin={handleLogin} onGuest={()=>setScreen("guest")} onAdmin={()=>setScreen("admin")} loading={authLoading}/>}
      {screen==="setup" && user && <ProfileSetup user={user} onComplete={u=>{setUser(u);setScreen("dashboard");}}/>}
      {screen==="dashboard" && user && <Dashboard user={user} onStartLesson={()=>setScreen(day<=2?"lesson":"test")} onViewHistory={()=>nav("history")} onEssay={()=>nav("essay")}/>}
      {screen==="lesson" && user && <LessonView user={user} lessonNum={lessonNum} day={day} onDayComplete={handleDayComplete}/>}
      {screen==="test" && user && <TestView user={user} lessonNum={lessonNum} attemptNum={attemptNum} onResult={handleTestResult}/>}
      {screen==="history" && user && <HistoryView user={user}/>}
      {screen==="essay" && user && <EssayView user={user} onBack={()=>nav("dashboard")}/>}
      {screen==="admin" && <AdminView onBack={()=>setScreen("landing")}/>}
      {screen==="guest" && (
        <div style={{ ...S.app, padding:24 }}>
          <div style={{ maxWidth:640, margin:"0 auto" }}>
            <button onClick={()=>setScreen("landing")} style={{ ...S.btn("rgba(255,255,255,0.1)"), marginBottom:20 }}>← Back</button>
            <Alert type="info">👀 <strong>Demo Mode</strong> — Create a free profile to save your progress!</Alert>
            <div style={{ ...S.card, marginBottom:16 }}>
              <Badge color={C.gold}>Sample Lesson — Vocabulary</Badge>
              <h2 style={{ ...S.h2, marginTop:12 }}>Word Power: Everyday Vocabulary</h2>
              {[{word:"Resilient",phonetic:"/rɪˈzɪliənt/",meaning:"Able to recover quickly from difficulties",example:"She was resilient in the face of challenges."},
                {word:"Articulate",phonetic:"/ɑːˈtɪkjʊleɪt/",meaning:"Able to express oneself clearly",example:"He was articulate in his presentation."}].map((v,i)=>(
                <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:14, marginTop:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontWeight:800, fontSize:17, color:C.gold }}>{v.word}</span>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:13, color:C.muted }}>{v.phonetic}</span>
                      <SpeakButton text={v.word}/>
                    </div>
                  </div>
                  <div style={{ fontSize:14, color:C.sky, marginTop:6 }}><strong>Meaning:</strong> {v.meaning}</div>
                  <div style={{ fontSize:14, fontStyle:"italic", marginTop:4 }}>{v.example}</div>
                </div>
              ))}
            </div>
            <button style={{ ...S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`), width:"100%", justifyContent:"center", padding:14 }} onClick={()=>setScreen("landing")}>✨ Create Free Profile</button>
          </div>
        </div>
      )}
    </div>
  );
}
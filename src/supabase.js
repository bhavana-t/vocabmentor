// src/supabase.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://avoudytkqdajuogtdhln.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: window.localStorage,
    storageKey: 'vocabmentor-auth'
  }
});

// ── Helper: retry fetching user row ──────────────────────────────────────────
async function waitForUserRow(uid, retries = 8, delay = 600) {
  for (let i = 0; i < retries; i++) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (data) return data;
    await new Promise(r => setTimeout(r, delay));
  }
  return null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function registerUser(email, password, username) {
  // 1. Check if this email already has a COMPLETE profile
  //    If yes → tell user to log in instead
  //    If no (incomplete) → clean up and let them re-register
  const { data: { user: existingAuth } } = await supabase.auth.getUser();

  // Try signing in first to detect the "registered but incomplete" case
  const { data: signInData } = await supabase.auth.signInWithPassword({ email, password }).catch(() => ({ data: null }));

  if (signInData?.user) {
    // User exists in auth — check if profile is complete
    const { data: existingProfile } = await supabase
      .from("users")
      .select("*")
      .eq("id", signInData.user.id)
      .maybeSingle();

    if (existingProfile?.profile) {
      // Profile complete — just log them in
      const tests = await getUserTests(signInData.user.id);
      const lessons = await getUserLessons(signInData.user.id);
      const essays = await getUserEssays(signInData.user.id);
      return { ...existingProfile, tests, lessons, essays };
    }

    if (existingProfile && !existingProfile.profile) {
      // Auth exists, row exists but profile not set — update username and return
      await supabase.from("users").update({ username }).eq("id", signInData.user.id);
      const fresh = await waitForUserRow(signInData.user.id);
      return { ...fresh, tests: [], lessons: [], essays: [] };
    }

    // Auth exists but no row — create it
    await supabase.from("users").insert({
      id: signInData.user.id,
      username, email,
      profile: null,
      current_lesson: 1, current_day: 1,
      streak: 0, last_active: null, badges: []
    }).then(() => {}).catch(() => {});
    const fresh = await waitForUserRow(signInData.user.id);
    return { ...(fresh || { id: signInData.user.id, username, email, current_lesson: 1, current_day: 1, streak: 0, badges: [] }), tests: [], lessons: [], essays: [] };
  }

  // 2. Fresh registration — sign up
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    // If "User already registered" — their password is wrong, show helpful message
    if (error.message?.includes("already registered") || error.status === 422) {
      throw new Error("This email is already registered. Please use the Log In button instead, or try a different email.");
    }
    throw error;
  }

  const uid = data.user.id;

  // 3. Wait for trigger to create row, then update username
  const row = await waitForUserRow(uid);
  if (row) {
    await supabase.from("users").update({ username }).eq("id", uid);
    return { ...row, username, tests: [], lessons: [], essays: [] };
  }

  // 4. Trigger didn't fire — insert manually
  await supabase.from("users").insert({
    id: uid, username, email,
    profile: null,
    current_lesson: 1, current_day: 1,
    streak: 0, last_active: null, badges: []
  }).then(() => {}).catch(() => {});

  const fresh = await waitForUserRow(uid);
  return { ...(fresh || { id: uid, username, email, current_lesson: 1, current_day: 1, streak: 0, badges: [] }), tests: [], lessons: [], essays: [] };
}

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Return immediately — App background-fetches full DB data
  return {
    id: data.user.id,
    email: data.user.email,
    username: data.user.email.split('@')[0],
    profile: null,
    current_lesson: 1, current_day: 1,
    streak: 0, badges: [],
    tests: [], lessons: [], essays: [],
    _dataLoading: true
  };
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

export async function clearStaleSession() {
  try {
    const stored = localStorage.getItem('vocabmentor-auth');
    if (!stored) return;
    const parsed = JSON.parse(stored);
    const expiresAt = parsed?.expires_at;
    if (!expiresAt) return;
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    if (expiresAt < sevenDaysAgo) {
      await supabase.auth.signOut();
      localStorage.removeItem('vocabmentor-auth');
    }
  } catch (e) {}
}

// Fast single-table fetch — no joins, no retries
export async function getBasicUser(uid) {
  const { data } = await supabase
    .from('users')
    .select('id, username, email, profile, current_lesson, current_day, streak, badges, last_active, created_at')
    .eq('id', uid)
    .maybeSingle();
  return data ? { ...data, tests: [], lessons: [], essays: [] } : null;
}

// Emits auth state only — App.js handles all data fetching
export async function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === "SIGNED_UP") { callback(null); return; }
      if (session?.user) {
        callback({ id: session.user.id, email: session.user.email, _authOnly: true });
      } else {
        callback(null);
      }
    }
  );
  return subscription;
}

// ── User data ─────────────────────────────────────────────────────────────────
export async function getUserData(uid) {
  const { data, error } = await supabase
    .from("users").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("User profile not found.");
  const tests = await getUserTests(uid);
  const lessons = await getUserLessons(uid);
  const essays = await getUserEssays(uid);
  return { ...data, tests, lessons, essays };
}

export async function saveProfile(uid, profile) {
  const { error } = await supabase.from("users").update({ profile }).eq("id", uid);
  if (error) throw error;
}

export async function advanceDay(uid) {
  const { data } = await supabase.from("users").select("current_day").eq("id", uid).maybeSingle();
  const newDay = ((data?.current_day) || 1) + 1;
  await supabase.from("users").update({ current_day: newDay }).eq("id", uid);
  return newDay;
}

export async function advanceLesson(uid, passed) {
  const { data } = await supabase.from("users").select("*").eq("id", uid).maybeSingle();
  const today = new Date().toDateString();
  const updates = passed
    ? {
        current_lesson: ((data?.current_lesson) || 1) + 1,
        current_day: 1,
        streak: data?.last_active !== today ? ((data?.streak) || 0) + 1 : (data?.streak || 0),
        last_active: today
      }
    : { current_day: 1 };
  await supabase.from("users").update(updates).eq("id", uid);
  return await getUserData(uid);
}

// ── Lessons ───────────────────────────────────────────────────────────────────
export async function saveLesson(uid, record) {
  await supabase.from("lessons").insert({ user_id: uid, ...record });
}

export async function getUserLessons(uid) {
  const { data } = await supabase.from("lessons").select("*").eq("user_id", uid).order("created_at", { ascending: false });
  return data || [];
}

// ── Tests ─────────────────────────────────────────────────────────────────────
export async function saveTest(uid, record) {
  await supabase.from("tests").insert({ user_id: uid, ...record });
}

export async function getUserTests(uid) {
  const { data } = await supabase.from("tests").select("*").eq("user_id", uid).order("created_at");
  return data || [];
}

// ── Essays ────────────────────────────────────────────────────────────────────
export async function saveEssay(uid, record) {
  const { data, error } = await supabase.from("essays").insert({ user_id: uid, ...record }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateEssay(essayId, updates) {
  const { error } = await supabase.from("essays").update(updates).eq("id", essayId);
  if (error) throw error;
}

export async function getUserEssays(uid) {
  const { data } = await supabase.from("essays").select("*").eq("user_id", uid).order("created_at", { ascending: false });
  return data || [];
}

// ── Micro learning plan ───────────────────────────────────────────────────────
// SQL needed: alter table users add column if not exists micro_plan jsonb;

export async function analyzeStudentStruggles(uid, lessonNum) {
  const { data: tests } = await supabase
    .from('tests').select('*')
    .eq('user_id', uid).eq('lesson_num', lessonNum).order('created_at');
  const { data: lessons } = await supabase
    .from('lessons').select('*')
    .eq('user_id', uid).order('created_at');
  return { tests: tests || [], lessons: lessons || [] };
}

export async function saveMicroPlan(uid, lessonNum, plan) {
  await supabase.from('users').update({
    micro_plan: { lessonNum, plan, startedAt: new Date().toISOString(),
                  currentMicroLesson: 0, completedMicroLessons: [] }
  }).eq('id', uid);
}

export async function updateMicroPlanProgress(uid, completedIndex) {
  const { data } = await supabase.from('users')
    .select('micro_plan').eq('id', uid).maybeSingle();
  const mp = data?.micro_plan || {};
  const updated = { ...mp,
    currentMicroLesson: completedIndex + 1,
    completedMicroLessons: [...(mp.completedMicroLessons || []), completedIndex] };
  await supabase.from('users').update({ micro_plan: updated }).eq('id', uid);
  return updated;
}

export async function clearMicroPlan(uid) {
  await supabase.from('users').update({ micro_plan: null }).eq('id', uid);
}

// ── Improvement tracking ──────────────────────────────────────────────────────
// SQL needed: alter table users add column if not exists improvement_tracking jsonb;

export async function getImprovementHistory(uid) {
  const { data: tests } = await supabase
    .from('tests')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(10);

  const suggestedImprovements = [
    ...(tests || []).flatMap(t => t.feedback?.improvements || []),
    ...(lessons || []).flatMap(l => l.feedback?.feedback?.improvements || [])
  ];

  const pastCorrections = [
    ...(tests || []).flatMap(t => t.feedback?.corrections || []),
    ...(lessons || []).flatMap(l => l.feedback?.feedback?.corrections || [])
  ];

  return { suggestedImprovements, pastCorrections, tests, lessons };
}

export async function saveImprovementTracking(uid, tracking) {
  await supabase.from('users').update({ improvement_tracking: tracking }).eq('id', uid);
}

// ── Parent view ───────────────────────────────────────────────────────────────
export async function getChildByUsername(username) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username.trim())
    .maybeSingle();
  if (!data) return null;
  const tests = await getUserTests(data.id);
  const lessons = await getUserLessons(data.id);
  const essays = await getUserEssays(data.id);
  return { ...data, tests, lessons, essays };
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function getAllUsers() {
  const { data } = await supabase.from("users").select("*").order("created_at");
  if (!data) return [];
  return await Promise.all(data.map(async u => {
    const tests = await getUserTests(u.id);
    const lessons = await getUserLessons(u.id);
    const essays = await getUserEssays(u.id);
    return { ...u, tests, lessons, essays };
  }));
}
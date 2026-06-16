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

  // Check if user row exists
  const row = await waitForUserRow(data.user.id);
  if (!row) {
    // Create it if missing
    await supabase.from("users").insert({
      id: data.user.id,
      username: email.split("@")[0],
      email,
      profile: null,
      current_lesson: 1, current_day: 1,
      streak: 0, last_active: null, badges: []
    }).then(() => {}).catch(() => {});
    const fresh = await waitForUserRow(data.user.id);
    return { ...(fresh || {}), tests: [], lessons: [], essays: [] };
  }

  const tests = await getUserTests(data.user.id);
  const lessons = await getUserLessons(data.user.id);
  const essays = await getUserEssays(data.user.id);
  return { ...row, tests, lessons, essays };
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

export async function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === "SIGNED_UP") {
        callback(null);
        return;
      }
      if (session?.user) {
        const uid = session.user.id;
        const timeoutId = setTimeout(() => { console.warn("Auth data fetch timed out"); callback(null); }, 8000);
        try {
          const row = await waitForUserRow(uid);
          if (row) {
            const tests = await getUserTests(uid);
            const lessons = await getUserLessons(uid);
            const essays = await getUserEssays(uid);
            clearTimeout(timeoutId);
            callback({ ...row, tests, lessons, essays });
          } else {
            clearTimeout(timeoutId);
            callback(null);
          }
        } catch (e) {
          clearTimeout(timeoutId);
          console.error("Auth change error:", e);
          callback(null);
        }
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
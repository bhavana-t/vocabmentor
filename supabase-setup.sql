// src/supabase.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://avoudytkqdajuogtdhln.supabase.co";
const SUPABASE_KEY = "sb_publishable_-BZWwrRSTaHtXtHAfPP7gA_I3bH4FDr"; // ← paste your publishable key

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function registerUser(email, password, username) {
  // 1. Sign up with Supabase Auth
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const uid = data.user.id;

  // 2. Check if user row already exists (avoid duplicate insert)
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("id", uid)
    .maybeSingle();

  // 3. Only insert if not already there
  if (!existing) {
    const { error: dbErr } = await supabase.from("users").insert({
      id: uid,
      username,
      email,
      profile: null,
      current_lesson: 1,
      current_day: 1,
      streak: 0,
      last_active: null,
      badges: []
    });
    if (dbErr) throw dbErr;
  }

  return await getUserData(uid);
}

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return await getUserData(data.user.id);
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

export async function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        try {
          const user = await getUserData(session.user.id);
          callback(user);
        } catch (e) {
          console.error("onAuthChange error:", e);
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
  // Use maybeSingle() instead of single() to avoid errors when no row found
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("User profile not found");

  // Fetch related data safely
  const tests = await getUserTests(uid);
  const lessons = await getUserLessons(uid);
  const essays = await getUserEssays(uid);

  return { ...data, tests, lessons, essays };
}

export async function saveProfile(uid, profile) {
  const { error } = await supabase
    .from("users")
    .update({ profile })
    .eq("id", uid);
  if (error) throw error;
}

export async function advanceDay(uid) {
  const { data } = await supabase
    .from("users")
    .select("current_day")
    .eq("id", uid)
    .maybeSingle();

  const newDay = ((data?.current_day) || 1) + 1;
  await supabase.from("users").update({ current_day: newDay }).eq("id", uid);
  return newDay;
}

export async function advanceLesson(uid, passed) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  const today = new Date().toDateString();
  const updates = passed
    ? {
        current_lesson: ((data?.current_lesson) || 1) + 1,
        current_day: 1,
        streak: data?.last_active !== today ? ((data?.streak) || 0) + 1 : data?.streak,
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
  const { data } = await supabase
    .from("lessons")
    .select("*")
    .eq("user_id", uid)
    .order("created_at");
  return data || [];
}

// ── Tests ─────────────────────────────────────────────────────────────────────
export async function saveTest(uid, record) {
  await supabase.from("tests").insert({ user_id: uid, ...record });
}

export async function getUserTests(uid) {
  const { data } = await supabase
    .from("tests")
    .select("*")
    .eq("user_id", uid)
    .order("created_at");
  return data || [];
}

// ── Essays ────────────────────────────────────────────────────────────────────
export async function saveEssay(uid, record) {
  const { data, error } = await supabase
    .from("essays")
    .insert({ user_id: uid, ...record })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateEssay(essayId, updates) {
  const { error } = await supabase
    .from("essays")
    .update(updates)
    .eq("id", essayId);
  if (error) throw error;
}

export async function getUserEssays(uid) {
  const { data } = await supabase
    .from("essays")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  return data || [];
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function getAllUsers() {
  const { data } = await supabase
    .from("users")
    .select("*")
    .order("created_at");
  if (!data) return [];
  return await Promise.all(
    data.map(async u => {
      const tests = await getUserTests(u.id);
      const essays = await getUserEssays(u.id);
      return { ...u, tests, essays };
    })
  );
}
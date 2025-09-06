// friendRes.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const SUPABASE_URL = "https://ruevzmnbhoowmuleeqjb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZXZ6bW5iaG9vd211bGVlcWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTUzNTIsImV4cCI6MjA2OTk3MTM1Mn0.tt_xEAqLGiv92mvqhQaEvsjTBE6cmYDC3kkQcyPqsTY";
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUserId = null;

export async function initFriendSystem() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  currentUserId = user.id;

  // listen for incoming requests
  listenForFriendRequests();
}

/* ✅ Send Friend Request */
export async function sendFriendRequest(receiverId) {
  if (!currentUserId) return;
  const { error } = await supabaseClient.from("friend_request").insert({
    sender_id: currentUserId,
    receiver_id: receiverId,
    status: "pending"
  });
  if (error) {
    console.error("Error sending request:", error);
    alert("Failed to send request.");
  } else {
    alert("Friend request sent!");
  }
}

/* 👂 Listen for incoming friend requests */
function listenForFriendRequests() {
  supabaseClient
    .channel("friend_request")
    .on("postgres_changes", { event: "*", schema: "public", table: "friend_request" }, payload => {
      const req = payload.new;
      if (!req) return;

      // only notify if I'm the receiver
      if (req.receiver_id === currentUserId && req.status === "pending") {
        showFriendRequestBanner(req.id, req.sender_id);
      }
    })
    .subscribe();
}

/* 🎭 Show banner when someone sends me a request */
async function showFriendRequestBanner(reqId, senderId) {
  if (document.getElementById("friendReqBanner")) return;

  const { data: sender } = await supabaseClient
    .from("profiles")
    .select("username")
    .eq("id", senderId)
    .single();

  const banner = document.createElement("div");
  banner.id = "friendReqBanner";
  banner.className = "friend-banner";
  banner.innerHTML = `
    👤 Friend request from <b>${sender?.username || "Unknown"}</b>
    <button onclick="window.acceptFriendReq('${reqId}','${senderId}')">Accept</button>
    <button onclick="window.declineFriendReq('${reqId}')">Decline</button>
  `;
  document.body.appendChild(banner);
}

/* ✅ Accept */
window.acceptFriendReq = async function(reqId, senderId) {
  await supabaseClient.from("friend_request").update({ status: "accepted" }).eq("id", reqId);

  // add each other to friends[] field
  const { data: profile } = await supabaseClient.from("profiles").select("friends").eq("id", currentUserId).single();
  const { data: senderProfile } = await supabaseClient.from("profiles").select("friends").eq("id", senderId).single();

  const myFriends = profile?.friends || [];
  const senderFriends = senderProfile?.friends || [];

  if (!myFriends.includes(senderId)) myFriends.push(senderId);
  if (!senderFriends.includes(currentUserId)) senderFriends.push(currentUserId);

  await supabaseClient.from("profiles").update({ friends: myFriends }).eq("id", currentUserId);
  await supabaseClient.from("profiles").update({ friends: senderFriends }).eq("id", senderId);

  document.getElementById("friendReqBanner")?.remove();
  alert("Friend request accepted!");
};

/* ❌ Decline */
window.declineFriendReq = async function(reqId) {
  await supabaseClient.from("friend_request").update({ status: "declined" }).eq("id", reqId);
  document.getElementById("friendReqBanner")?.remove();
};

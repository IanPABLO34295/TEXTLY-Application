// ===========================================
// Firebase Integration: Auth & Firestore Imports
// ===========================================
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

import { getApps } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";

// Use the already-initialized Firebase app from index.html
const app = getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// ===========================================
// Chat App Code (Authentication & Chat)
// ===========================================
document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;
  let currentConversationId = null;

  // --- DOM Elements ---
  const authContainer = document.getElementById("authContainer");
  const loginFormContainer = document.getElementById("loginFormContainer");
  const signupFormContainer = document.getElementById("signupFormContainer");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const chatSection = document.getElementById("chatSection");
  const logoutBtn = document.getElementById("logout-btn");
  const conversationListEl = document.getElementById("conversationList");
  const conversationTitleEl = document.getElementById("conversationTitle");
  const chatMessages = document.getElementById("chatMessages");
  const sendButton = document.getElementById("sendButton");
  const messageInput = document.getElementById("messageInput");
  const imageUploadBtn = document.getElementById("imageUploadBtn");
  const imageInput = document.getElementById("imageInput");
  const newChatBtn = document.getElementById("newChatBtn");
  const newGroupBtn = document.getElementById("newGroupBtn");
  const userSearch = document.getElementById("userSearch");

  // --- LocalStorage Keys (simulate chat storage) ---
  const CONVERSATIONS_KEY = "conversations";

  // ========== Utility Functions for Chat Storage ==========
  function getConversations() {
    return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || "{}");
  }
  function saveConversations(convos) {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convos));
  }

  // Update the conversation list in the sidebar
  function updateConversationList() {
    const convos = getConversations();
    conversationListEl.innerHTML = "";
    if (!currentUser) return;

    const currentIdentifier = currentUser.email || currentUser.uid;

    for (let id in convos) {
      const convo = convos[id];
      if (convo.participants.includes(currentIdentifier)) {
        const div = document.createElement("div");
        div.classList.add("conversation-item");
        if (convo.isGroup) {
          div.textContent = convo.title; // group name
        } else {
          // Show the other participant's email
          const other = convo.participants.find(u => u !== currentIdentifier);
          div.textContent = other;
        }
        div.addEventListener("click", () => {
          currentConversationId = id;
          conversationTitleEl.textContent = convo.isGroup ? convo.title : div.textContent;
          loadConversationMessages();
        });
        conversationListEl.appendChild(div);
      }
    }
  }

  // Load messages for the selected conversation
  function loadConversationMessages() {
    chatMessages.innerHTML = "";
    const convos = getConversations();
    const convo = convos[currentConversationId];
    if (convo) {
      convo.messages.forEach(msg => {
        if (msg.type === "text") {
          addMessage(
            msg.content,
            msg.sender === (currentUser.email || currentUser.uid) ? "sent" : "received",
            false
          );
        } else if (msg.type === "image") {
          addImageMessage(
            msg.content,
            msg.sender === (currentUser.email || currentUser.uid) ? "sent" : "received",
            false
          );
        }
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function addMessage(text, type, scroll = true) {
    const messageEl = document.createElement("div");
    messageEl.classList.add("message", type);
    const textEl = document.createElement("div");
    textEl.classList.add("text");
    textEl.textContent = text;
    messageEl.appendChild(textEl);
    chatMessages.appendChild(messageEl);
    if (scroll) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addImageMessage(imgSrc, type, scroll = true) {
    const messageEl = document.createElement("div");
    messageEl.classList.add("message", type);
    const imgEl = document.createElement("img");
    imgEl.src = imgSrc;
    messageEl.appendChild(imgEl);
    chatMessages.appendChild(messageEl);
    if (scroll) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Save a message to the localStorage-based conversation
  function saveMessageToConversation(messageObj) {
    let convos = getConversations();
    if (!convos[currentConversationId]) return;
    convos[currentConversationId].messages.push(messageObj);
    saveConversations(convos);
    loadConversationMessages();
  }

  // ========== UI Display Functions ==========
  function showAuth() {
    chatSection.style.display = "none";
    authContainer.style.display = "block";
  }
  function showChat() {
    authContainer.style.display = "none";
    chatSection.style.display = "flex";
    updateConversationList();
  }

  // ========== Firebase Auth State Listener ==========
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      showChat();
    } else {
      showAuth();
    }
  });

  // ========== Tab Switching for Auth ==========
  loginTab.addEventListener("click", () => {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    loginFormContainer.style.display = "block";
    signupFormContainer.style.display = "none";
  });
  signupTab.addEventListener("click", () => {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    signupFormContainer.style.display = "block";
    loginFormContainer.style.display = "none";
  });

  // ========== Email/Password Login ==========
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    if (email && password) {
      signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          currentUser = userCredential.user;
          showChat();
        })
        .catch((error) => {
          alert("Login failed: " + error.message);
        });
    }
  });

  // ========== Email/Password Sign Up with Firestore user doc ==========
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signupUsername").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    if (email && password) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // Save user data in Firestore (users collection)
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          // You can add phone or displayName if you like
        });
        currentUser = user;
        showChat();
      } catch (error) {
        alert("Sign Up failed: " + error.message);
      }
    }
  });

  // ========== Social Login (Google, Facebook, Twitter) ==========
  document.querySelectorAll(".social-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const providerName = btn.getAttribute("data-provider");
      let provider;
      if (providerName === "Google") {
        provider = new GoogleAuthProvider();
      } else if (providerName === "Facebook") {
        provider = new FacebookAuthProvider();
      } else if (providerName === "Twitter") {
        provider = new TwitterAuthProvider();
      } else if (providerName === "Phone") {
        alert("Phone authentication is not implemented in this demo.");
        return;
      }
      try {
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        // Optionally, also store user in Firestore if not there yet
        // (You can check with doc(db, "users", currentUser.uid) if it exists)
        await setDoc(doc(db, "users", currentUser.uid), {
          email: currentUser.email,
        }, { merge: true });
        showChat();
      } catch (error) {
        alert("Social login failed: " + error.message);
      }
    });
  });

  // ========== Logout ==========
  logoutBtn.addEventListener("click", async () => {
    try {
      await auth.signOut();
      currentUser = null;
      currentConversationId = null;
      showAuth();
    } catch (error) {
      alert("Logout failed: " + error.message);
    }
  });

  // ========== Chat Functionality ==========

  // 1) "New Chat": Query Firestore to see if the user with target email exists
  newChatBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    let targetUser = prompt("Enter the email of the user to chat with:");
    if (!targetUser) return;
    targetUser = targetUser.trim().toLowerCase();

    // Prevent chatting with yourself
    const currentIdentifier = currentUser.email.toLowerCase();
    if (targetUser === currentIdentifier) {
      alert("Invalid: you can't chat with yourself.");
      return;
    }

    // Check Firestore "users" collection for a doc with this email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", targetUser));
    const querySnap = await getDocs(q);

    if (querySnap.empty) {
      alert("User not found in Firestore.");
      return;
    }

    // Found at least one user doc
    const docSnap = querySnap.docs[0];
    const userData = docSnap.data();
    const userUid = docSnap.id; // the doc's ID is user.uid

    // Create or load the conversation in localStorage
    let convoId = "chat_" + [currentIdentifier, targetUser].sort().join("_");
    let convos = getConversations();
    if (!convos[convoId]) {
      convos[convoId] = {
        id: convoId,
        isGroup: false,
        participants: [currentIdentifier, targetUser],
        messages: []
      };
      saveConversations(convos);
    }
    currentConversationId = convoId;
    conversationTitleEl.textContent = targetUser;
    loadConversationMessages();
    updateConversationList();
  });

  // 2) "New Group Chat": still uses localStorage for conversation data
  newGroupBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    let groupName = prompt("Enter a group chat name:");
    if (!groupName) return;
    let usersInput = prompt("Enter emails to add (comma separated):");
    if (!usersInput) return;

    const currentIdentifier = currentUser.email.toLowerCase();
    let participants = usersInput
      .split(",")
      .map(u => u.trim().toLowerCase())
      .filter(u => u && u !== currentIdentifier);

    // We'll check each email in Firestore
    let validParticipants = [];
    for (let email of participants) {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        validParticipants.push(email);
      }
    }

    if (validParticipants.length === 0) {
      alert("No valid users found in Firestore.");
      return;
    }

    validParticipants.push(currentIdentifier);
    let convoId = "group_" + Date.now();
    let convos = getConversations();
    convos[convoId] = {
      id: convoId,
      isGroup: true,
      title: groupName,
      participants: validParticipants,
      messages: []
    };
    saveConversations(convos);

    currentConversationId = convoId;
    conversationTitleEl.textContent = groupName;
    loadConversationMessages();
    updateConversationList();
  });

  // 3) Sending a text message
  sendButton.addEventListener("click", () => {
    if (!currentConversationId || !currentUser) return;
    const text = messageInput.value.trim();
    if (!text) return;

    const messageObj = {
      sender: currentUser.email || currentUser.uid,
      type: "text",
      content: text,
      timestamp: Date.now()
    };
    saveMessageToConversation(messageObj);
    messageInput.value = "";
  });
  messageInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") sendButton.click();
  });

  // 4) Sending an image
  imageUploadBtn.addEventListener("click", () => {
    if (!currentConversationId || !currentUser) return;
    imageInput.click();
  });
  imageInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0] && currentConversationId) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = function(event) {
        const messageObj = {
          sender: currentUser.email || currentUser.uid,
          type: "image",
          content: event.target.result,
          timestamp: Date.now()
        };
        saveMessageToConversation(messageObj);
      };
      reader.readAsDataURL(file);
      imageInput.value = "";
    }
  });

  // 5) Searching users with the search bar (optional improvement)
  userSearch.addEventListener("input", async () => {
    const queryValue = userSearch.value.trim().toLowerCase();
    if (!queryValue) {
      // If empty, just update the conversation list
      updateConversationList();
      return;
    }

    // Search in Firestore "users" collection by partial email
    // For advanced usage, you might need a more robust search solution
    // Firestore doesn't do partial string matches easily without an index
    // So we'll do a naive approach: get all users, filter client-side
    // For large user bases, you'd store a separate search index or use a service like Algolia

    const usersRef = collection(db, "users");
    const allSnap = await getDocs(usersRef);
    const results = [];
    allSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.email.toLowerCase().includes(queryValue)) {
        results.push(data.email);
      }
    });

    // Show search results in the conversationList
    conversationListEl.innerHTML = "";
    for (let email of results) {
      // Skip self
      if (email === (currentUser.email || currentUser.uid)) continue;

      const div = document.createElement("div");
      div.classList.add("conversation-item");
      div.textContent = email;
      div.addEventListener("click", async () => {
        // Attempt to start or load a conversation with this user
        let convoId = "chat_" + [
          (currentUser.email || currentUser.uid).toLowerCase(),
          email.toLowerCase()
        ].sort().join("_");

        let convos = getConversations();
        if (!convos[convoId]) {
          convos[convoId] = {
            id: convoId,
            isGroup: false,
            participants: [
              (currentUser.email || currentUser.uid).toLowerCase(),
              email.toLowerCase()
            ],
            messages: []
          };
          saveConversations(convos);
        }
        currentConversationId = convoId;
        conversationTitleEl.textContent = email;
        loadConversationMessages();
        updateConversationList();
      });
      conversationListEl.appendChild(div);
    }
  });

  // Listen for localStorage changes across tabs
  window.addEventListener("storage", (e) => {
    if (e.key === CONVERSATIONS_KEY) {
      updateConversationList();
      if (currentConversationId) loadConversationMessages();
    }
  });
});
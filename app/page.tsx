"use client";

import { useEffect, useState, useRef } from "react";

// ─── Email Verification ────────────────────────────────────────────────────
// After signup the server returns { needsVerification: true, verifyToken }
// (token shown in-UI in dev mode since no email service is configured).
// The user must enter the 6-digit code before the main app is shown.

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

type User = { email: string };
type SellerStatus = { connected: boolean; ready: boolean };
type Profile = { display_name: string; avatar_url: string; role: "buyer" | "seller" };
type Category = { id: number; name: string; slug: string; parent_id: number | null };
type Listing = {
  id: number;
  seller_email: string;
  title: string;
  description: string;
  category_id: number;
  condition: string;
  price_cents: number;
  quantity: number;
  status: string;
  created_at: string;
  photos: string[];
  category_name: string;
};

type SellerProfile = { display_name: string; avatar_url: string };

type CartItem = {
  listing: Listing;
  quantity: number;
};

type ShippingAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

type OrderItem = {
  order_id: number;
  listing_id: number;
  seller_email: string;
  quantity: number;
  unit_price_cents: number;
  title_snapshot: string;
  status: string;
  tracking_number?: string | null;
  carrier?: string | null;
};

type Order = {
  id: number;
  status: string;
  total_cents: number;
  shipping_address: ShippingAddress;
  stripe_session_id: string;
  created_at: string;
  items: OrderItem[];
};

type SellerOrderItem = {
  id: number;
  order_id: number;
  listing_id: number;
  buyer_email: string;
  quantity: number;
  unit_price_cents: number;
  title_snapshot: string;
  status: string;
  created_at: string;
  shipping_address: ShippingAddress;
  stripe_session_id: string;
  tracking_number: string | null;
  carrier: string | null;
};

type Message = {
  id: number;
  listing_id: number;
  sender_email: string;
  recipient_email: string;
  body: string;
  created_at: string;
};

type MessageThread = {
  listing_id: number;
  listing_title: string;
  other_email: string;
  messages: Message[];
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authRole, setAuthRole] = useState<"buyer" | "seller">("buyer");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Email verification
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyDevToken, setVerifyDevToken] = useState(""); // shown in dev mode
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResent, setVerifyResent] = useState(false);

  // Forgot-password flow
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [forgotTokenInput, setForgotTokenInput] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotNewPasswordConfirm, setForgotNewPasswordConfirm] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const [sellerStatus, setSellerStatus] = useState<SellerStatus | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);

  const [profile, setProfile] = useState<Profile>({ display_name: "", avatar_url: "", role: "buyer" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, SellerProfile>>({});

  const [view, setView] = useState<"browse" | "sell" | "mylistings" | "watchlist" | "profile" | "purchases">("browse");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  // Search & filter state
  const [searchQ, setSearchQ] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [listingsLoading, setListingsLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [addedToCart, setAddedToCart] = useState(false);

  // Shipping address modal
  const [shippingOpen, setShippingOpen] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US",
  });

  // Purchases / seller orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellerOrders, setSellerOrders] = useState<SellerOrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [myListingsTab, setMyListingsTab] = useState<"listings" | "orders" | "messages">("listings");

  // Shipping UI state (seller)
  const [shipOpen, setShipOpen] = useState<Record<number, boolean>>({});
  const [shipTracking, setShipTracking] = useState<Record<number, string>>({});
  const [shipCarrier, setShipCarrier] = useState<Record<number, string>>({});
  const [shipLoading, setShipLoading] = useState<Record<number, boolean>>({});
  const [shipSuccess, setShipSuccess] = useState<Record<number, string>>({});
  const [shipError, setShipError] = useState<Record<number, string>>({});

  // Messaging
  const [chatOpen, setChatOpen] = useState(false);
  const [chatListing, setChatListing] = useState<Listing | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [sellerThreads, setSellerThreads] = useState<MessageThread[]>([]);
  const [sellerThreadsLoading, setSellerThreadsLoading] = useState(false);
  const [activeThread, setActiveThread] = useState<MessageThread | null>(null);
  const [threadInput, setThreadInput] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);

  // New listing form
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState<number | "">("");
  const [formCondition, setFormCondition] = useState("good");
  const [formPrice, setFormPrice] = useState("");
  const [formQuantity, setFormQuantity] = useState("1");
  const [formPhotos, setFormPhotos] = useState<File[]>([]);
  const [formPhotoUrls, setFormPhotoUrls] = useState<string[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const threadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkAuth();
    fetchCategories();
    fetchListings({});

    // After Stripe onboarding, they land back at /?seller=done or /?seller=retry
    const params = new URLSearchParams(window.location.search);
    const sellerParam = params.get("seller");
    if (sellerParam === "done" || sellerParam === "retry") {
      // Clean the URL so refreshing doesn't re-trigger
      window.history.replaceState({}, "", window.location.pathname);
      // Switch to sell view so user sees their updated status
      setView("sell");
    }
    // After successful checkout, mark order paid and show purchases
    const checkoutParam = params.get("checkout");
    const orderParam = params.get("order");
    if (checkoutParam === "success" && orderParam) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSellerStatus();
      fetchMyListings();
      fetchProfile();
      fetchOrders();
      fetchSellerOrders();

      // Re-check seller status if returning from Stripe
      const params = new URLSearchParams(window.location.search);
      const sellerParam = params.get("seller");
      if (sellerParam === "done" || sellerParam === "retry") {
        setView("sell");
      }
      const checkoutParam = params.get("checkout");
      const orderParam = params.get("order");
      if (checkoutParam === "success" && orderParam) {
        // Mark the order paid then show purchases
        fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stripe_session_id: orderParam }),
        }).then(() => {
          fetchOrders();
          setCart([]);
          setView("purchases");
        });
      }
    }
  }, [user]);

  useEffect(() => {
    fetchListings({ categoryId: selectedCategory, q: searchQ, condition: filterCondition, minPrice: filterMinPrice, maxPrice: filterMaxPrice });
  }, [selectedCategory]);

  useEffect(() => {
    const emails = Array.from(new Set(listings.map((l) => l.seller_email)));
    const missing = emails.filter((e) => !(e in sellerProfiles));
    if (missing.length === 0) return;
    missing.forEach((email) => {
      fetch(`/api/profile?email=${encodeURIComponent(email)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data && data.display_name !== undefined) {
            setSellerProfiles((prev) => ({ ...prev, [email]: data as SellerProfile }));
          }
        })
        .catch(() => {});
    });
  }, [listings]);

  useEffect(() => {
    if (!user) return;
    if (view === "sell") fetchSellerStatus();
    if (view === "purchases") fetchOrders();
    if (view === "mylistings") { fetchMyListings(); fetchSellerOrders(); }
  }, [view]);

  // Poll chat when open
  useEffect(() => {
    if (chatOpen && chatListing) {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
      chatPollRef.current = setInterval(() => {
        fetchChatMessages(chatListing.id);
      }, 30000);
    } else {
      if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [chatOpen, chatListing]);

  // Poll seller thread when open
  useEffect(() => {
    if (activeThread) {
      if (threadPollRef.current) clearInterval(threadPollRef.current);
      threadPollRef.current = setInterval(() => {
        fetchThreadMessages(activeThread.listing_id, activeThread.other_email);
      }, 30000);
    } else {
      if (threadPollRef.current) { clearInterval(threadPollRef.current); threadPollRef.current = null; }
    }
    return () => { if (threadPollRef.current) clearInterval(threadPollRef.current); };
  }, [activeThread]);

  // Scroll to bottom when chat messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread]);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth");
      if (res.ok) {
        const data = await res.json();
        if (data.email) setUser({ email: data.email });
      }
    } catch {}
  }

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {}
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSaved(false);
    setProfileLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setProfileError(d.error || "Failed to save");
      } else {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
      }
    } catch {
      setProfileError("Network error");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setProfile((p) => ({ ...p, avatar_url: data.url }));
  }

  async function fetchSellerStatus() {
    try {
      const res = await fetch("/api/seller");
      if (res.ok) {
        const data = await res.json();
        setSellerStatus(data);
      }
    } catch {}
  }

  async function fetchCategories() {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch {}
  }

  async function fetchListings(opts: {
    categoryId?: number | null;
    q?: string;
    condition?: string;
    minPrice?: string;
    maxPrice?: string;
  } = {}) {
    setListingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.categoryId) params.set("category", String(opts.categoryId));
      if (opts.q && opts.q.trim()) params.set("q", opts.q.trim());
      if (opts.condition) params.set("condition", opts.condition);
      if (opts.minPrice && opts.minPrice.trim()) params.set("min_price", opts.minPrice.trim());
      if (opts.maxPrice && opts.maxPrice.trim()) params.set("max_price", opts.maxPrice.trim());
      const url = "/api/listings" + (params.toString() ? "?" + params.toString() : "");
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch {}
    finally { setListingsLoading(false); }
  }

  function triggerSearch(opts: {
    q?: string;
    condition?: string;
    minPrice?: string;
    maxPrice?: string;
    categoryId?: number | null;
  }) {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchListings(opts);
    }, 320);
  }
  
  async function fetchOrders() {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/orders");
      if (res.ok) setOrders(await res.json());
    } catch {}
    finally { setOrdersLoading(false); }
  }

  async function fetchSellerOrders() {
    try {
      const res = await fetch("/api/orders?role=seller");
      if (res.ok) setSellerOrders(await res.json());
    } catch {}
  }

  async function handleMarkShipped(itemId: number) {
    const tracking = (shipTracking[itemId] || "").trim();
    const carrier = (shipCarrier[itemId] || "").trim();
    setShipError((prev) => ({ ...prev, [itemId]: "" }));
    if (!carrier) {
      setShipError((prev) => ({ ...prev, [itemId]: "Please select a carrier." }));
      return;
    }
    if (!tracking) {
      setShipError((prev) => ({ ...prev, [itemId]: "Please enter a tracking number." }));
      return;
    }
    setShipLoading((prev) => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ship", order_item_id: itemId, tracking_number: tracking, carrier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShipError((prev) => ({ ...prev, [itemId]: data.error || "Failed to update." }));
      } else {
        setShipSuccess((prev) => ({ ...prev, [itemId]: "Marked as shipped! ✓" }));
        setShipOpen((prev) => ({ ...prev, [itemId]: false }));
        fetchSellerOrders();
        setTimeout(() => setShipSuccess((prev) => ({ ...prev, [itemId]: "" })), 4000);
      }
    } catch {
      setShipError((prev) => ({ ...prev, [itemId]: "Network error." }));
    } finally {
      setShipLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function fetchChatMessages(listingId: number) {
    setChatLoading(true);
    try {
      const res = await fetch(`/api/messages?listing_id=${listingId}`);
      if (res.ok) setChatMessages(await res.json());
    } catch {}
    finally { setChatLoading(false); }
  }

  async function openChat(listing: Listing) {
    setChatListing(listing);
    setChatInput("");
    setChatMessages([]);
    setChatOpen(true);
    await fetchChatMessages(listing.id);
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !chatListing || chatSending) return;
    setChatSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: chatListing.id,
          recipient_email: chatListing.seller_email,
          body: chatInput.trim(),
        }),
      });
      if (res.ok) {
        setChatInput("");
        await fetchChatMessages(chatListing.id);
      }
    } catch {}
    finally { setChatSending(false); }
  }

  async function fetchSellerThreads() {
    setSellerThreadsLoading(true);
    try {
      // Get all threads (latest message per listing)
      const res = await fetch("/api/messages");
      if (!res.ok) return;
      const summaries: (Message & { listing_title?: string })[] = await res.json();

      // For each unique listing_id, fetch full thread
      const seen = new Map<number, Message>();
      for (const m of summaries) {
        if (!seen.has(m.listing_id)) seen.set(m.listing_id, m);
      }

      const threads: MessageThread[] = [];
      for (const [lid, latest] of seen.entries()) {
        const other = latest.sender_email === user!.email ? latest.recipient_email : latest.sender_email;
        const tRes = await fetch(`/api/messages?listing_id=${lid}`);
        const msgs: Message[] = tRes.ok ? await tRes.json() : [];
        // Try to get listing title from myListings or listings
        const found = myListings.find((l) => l.id === lid) || listings.find((l) => l.id === lid);
        threads.push({
          listing_id: lid,
          listing_title: found?.title || `Listing #${lid}`,
          other_email: other,
          messages: msgs,
        });
      }
      setSellerThreads(threads);
    } catch {}
    finally { setSellerThreadsLoading(false); }
  }

  async function fetchThreadMessages(listingId: number, otherEmail: string) {
    try {
      const res = await fetch(`/api/messages?listing_id=${listingId}`);
      if (!res.ok) return;
      const msgs: Message[] = await res.json();
      setActiveThread((prev) => prev && prev.listing_id === listingId ? { ...prev, messages: msgs } : prev);
    } catch {}
  }

  async function sendThreadMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!threadInput.trim() || !activeThread || threadSending) return;
    setThreadSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: activeThread.listing_id,
          recipient_email: activeThread.other_email,
          body: threadInput.trim(),
        }),
      });
      if (res.ok) {
        setThreadInput("");
        await fetchThreadMessages(activeThread.listing_id, activeThread.other_email);
      }
    } catch {}
    finally { setThreadSending(false); }
  }

  function clearFilters() {
    setSearchQ("");
    setFilterCondition("");
    setFilterMinPrice("");
    setFilterMaxPrice("");
    setSelectedCategory(null);
    fetchListings({});
  }

  async function fetchMyListings() {
    try {
      const res = await fetch("/api/my-listings");
      if (res.ok) {
        const data = await res.json();
        setMyListings(data);
      }
    } catch {}
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");

    if (authMode === "signup") {
      if (!authDisplayName.trim()) {
        setAuthError("Please enter your name.");
        return;
      }
      if (authPassword !== authPasswordConfirm) {
        setAuthError("Passwords do not match.");
        return;
      }
    }

    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: authMode, email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Something went wrong");
      } else {
        if (authMode === "signup") {
          // Save display name and role right after account creation
          await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              display_name: authDisplayName.trim(),
              avatar_url: "",
              role: authRole,
            }),
          });
          // Trigger email verification
          const vRes = await fetch("/api/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "send", email: authEmail }),
          });
          const vData = await vRes.json();
          setVerifyEmail(authEmail);
          setVerifyDevToken(vData.token || "");
          setVerifyInput("");
          setVerifyError("");
          setVerifyResent(false);
          setVerifyOpen(true);
        } else {
          // Login — check if verified
          if (data.needsVerification) {
            const vRes = await fetch("/api/verify-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "send", email: authEmail }),
            });
            const vData = await vRes.json();
            setVerifyEmail(authEmail);
            setVerifyDevToken(vData.token || "");
            setVerifyInput("");
            setVerifyError("");
            setVerifyResent(false);
            setVerifyOpen(true);
          } else {
            setUser({ email: authEmail });
          }
        }
      }
    } catch {
      setAuthError("Network error");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError("");
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "verify", email: verifyEmail, token: verifyInput.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || "Invalid code. Please try again.");
      } else {
        setVerifyOpen(false);
        setUser({ email: verifyEmail });
      }
    } catch {
      setVerifyError("Network error.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleResendVerify() {
    setVerifyResent(false);
    setVerifyError("");
    try {
      const vRes = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "send", email: verifyEmail }),
      });
      const vData = await vRes.json();
      setVerifyDevToken(vData.token || "");
      setVerifyResent(true);
      setTimeout(() => setVerifyResent(false), 3000);
    } catch {}
  }

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "logout" }),
    });
    setUser(null);
    setSellerStatus(null);
    setMyListings([]);
    setProfile({ display_name: "", avatar_url: "", role: "buyer" });
    setAuthEmail("");
    setAuthPassword("");
    setAuthPasswordConfirm("");
    setAuthDisplayName("");
    setAuthRole("buyer");
    setView("browse");
  }

  function openForgot() {
    setForgotOpen(true);
    setForgotStep("request");
    setForgotEmail(authEmail);
    setForgotToken("");
    setForgotTokenInput("");
    setForgotNewPassword("");
    setForgotNewPasswordConfirm("");
    setForgotError("");
    setForgotSuccess("");
  }

  function closeForgot() {
    setForgotOpen(false);
  }

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "request", email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || "Something went wrong.");
      } else {
        // In production this token would arrive by email.
        // Here we surface it directly so the flow is testable without an email service.
        setForgotToken(data.token === "NO_ACCOUNT" ? "" : data.token);
        setForgotStep("reset");
        if (data.token === "NO_ACCOUNT") {
          setForgotSuccess("If that email has an account, a reset code has been sent.");
        } else {
          setForgotSuccess(""); // token shown in UI below
        }
      }
    } catch {
      setForgotError("Network error.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleForgotReset(e: React.FormEvent) {
    e.preventDefault();
    setForgotError("");
    if (forgotNewPassword !== forgotNewPasswordConfirm) {
      setForgotError("Passwords do not match.");
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError("Password must be at least 6 characters.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reset", email: forgotEmail, token: forgotTokenInput, password: forgotNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || "Reset failed.");
      } else {
        setForgotSuccess("Password updated! You can now sign in with your new password.");
        setTimeout(() => {
          closeForgot();
        }, 2200);
      }
    } catch {
      setForgotError("Network error.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleSetupPayouts() {
    setSellerLoading(true);
    try {
      const res = await fetch("/api/seller", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setSellerLoading(false);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setFormPhotos((prev) => [...prev, ...files]);
    const previews = files.map((f) => URL.createObjectURL(f));
    setFormPhotoUrls((prev) => [...prev, ...previews]);
  }

  function removePhoto(index: number) {
    setFormPhotos((prev) => prev.filter((_, i) => i !== index));
    setFormPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    if (!formTitle.trim()) { setFormError("Title is required"); return; }
    if (!formCategory) { setFormError("Category is required"); return; }
    if (!formPrice || isNaN(parseFloat(formPrice)) || parseFloat(formPrice) <= 0) {
      setFormError("Valid price is required"); return;
    }
    setFormLoading(true);
    try {
      // Upload photos first
      const uploadedUrls: string[] = [];
      for (const file of formPhotos) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) uploadedUrls.push(data.url);
      }

      const res = await fetch("/api/my-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc.trim(),
          category_id: Number(formCategory),
          condition: formCondition,
          price_cents: Math.round(parseFloat(formPrice) * 100),
          quantity: parseInt(formQuantity) || 1,
          photos: uploadedUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create listing");
      } else {
        setFormSuccess("Listing created successfully!");
        setFormTitle(""); setFormDesc(""); setFormCategory("");
        setFormCondition("good"); setFormPrice(""); setFormQuantity("1");
        setFormPhotos([]); setFormPhotoUrls([]);
        fetchMyListings();
        fetchListings({ categoryId: selectedCategory });
        setTimeout(() => { setView("mylistings"); setFormSuccess(""); }, 1500);
      }
    } catch {
      setFormError("Network error");
    } finally {
      setFormLoading(false);
    }
  }

  async function handlePauseResume(listing: Listing) {
    const newStatus = listing.status === "active" ? "paused" : "active";
    await fetch("/api/my-listings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: listing.id, status: newStatus }),
    });
    fetchMyListings();
    fetchListings({ categoryId: selectedCategory });
  }

  function addToCart(listing: Listing, qty: number) {
    setCart((prev) => {
      const existing = prev.find((i) => i.listing.id === listing.id);
      if (existing) {
        return prev.map((i) =>
          i.listing.id === listing.id
            ? { ...i, quantity: Math.min(i.quantity + qty, listing.quantity) }
            : i
        );
      }
      return [...prev, { listing, quantity: Math.min(qty, listing.quantity) }];
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 1800);
  }

  function removeFromCart(listingId: number) {
    setCart((prev) => prev.filter((i) => i.listing.id !== listingId));
  }

  function cartTotal() {
    return cart.reduce((sum, i) => sum + i.listing.price_cents * i.quantity, 0);
  }

  function openShippingModal() {
    setShippingAddress((prev) => ({
      ...prev,
      name: prev.name || profile.display_name || "",
    }));
    setCheckoutError("");
    setShippingOpen(true);
  }

  async function handleCheckout() {
    // Validate address
    if (!shippingAddress.name.trim() || !shippingAddress.line1.trim() ||
        !shippingAddress.city.trim() || !shippingAddress.state.trim() ||
        !shippingAddress.zip.trim()) {
      setCheckoutError("Please fill in all required address fields.");
      return;
    }
    setCheckoutError("");
    setCheckoutLoading(true);
    try {
      const stripeItems = cart.map((i) => ({
        name: i.listing.title,
        amount_cents: i.listing.price_cents,
        quantity: i.quantity,
        seller_email: i.listing.seller_email,
      }));
      const stripeRes = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: stripeItems }),
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok || !stripeData.url) {
        setCheckoutError(stripeData.error || "Checkout failed. Please try again.");
        setCheckoutLoading(false);
        return;
      }
      // Save order to DB before redirecting
      const orderItems = cart.map((i) => ({
        listing_id: i.listing.id,
        seller_email: i.listing.seller_email,
        quantity: i.quantity,
        unit_price_cents: i.listing.price_cents,
        title_snapshot: i.listing.title,
      }));
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_address: shippingAddress,
          items: orderItems,
          stripe_session_id: stripeData.sessionId,
        }),
      });
      window.location.href = stripeData.url;
    } catch {
      setCheckoutError("Network error. Please try again.");
      setCheckoutLoading(false);
    }
  }

  async function handleRemoveListing(listing: Listing) {
    if (!confirm("Remove this listing?")) return;
    await fetch("/api/my-listings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: listing.id, status: "removed" }),
    });
    fetchMyListings();
    fetchListings({ categoryId: selectedCategory });
  }

  const topCategories = categories.filter((c) => c.parent_id === null);

  // ─── Watchlist ─────────────────────────────────────────────────────────────
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [watchLoading, setWatchLoading] = useState(false);
  const [watchedListings, setWatchedListings] = useState<Listing[]>([]);

  useEffect(() => {
    if (user) fetchWatchlist();
  }, [user]);

  async function fetchWatchlist() {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const data: { listing_id: number }[] = await res.json();
        setWatchedIds(new Set(data.map((r) => r.listing_id)));
        // Resolve full listing objects from the already-loaded listings array
        // We'll refresh after listings load too
        setWatchedListings((prev) => {
          void prev;
          return [];
        });
      }
    } catch {}
  }

  // Keep watchedListings in sync whenever listings or watchedIds change
  useEffect(() => {
    if (watchedIds.size === 0) {
      setWatchedListings([]);
      return;
    }
    // Fetch all listings without a category filter to find watched ones
    fetch("/api/listings")
      .then((r) => r.ok ? r.json() : [])
      .then((all: Listing[]) => {
        setWatchedListings(all.filter((l) => watchedIds.has(l.id)));
      })
      .catch(() => {});
  }, [watchedIds]);

  async function toggleWatch(listingId: number) {
    setWatchLoading(true);
    try {
      const watching = watchedIds.has(listingId);
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, action: watching ? "unwatch" : "watch" }),
      });
      setWatchedIds((prev) => {
        const next = new Set(prev);
        if (watching) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
    } catch {}
    setWatchLoading(false);
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  const s: Record<string, React.CSSProperties> = {
    root: { fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f6f6f4", color: "#111" },
    header: {
      background: "#fff", borderBottom: "1px solid #e5e5e5",
      padding: "0 24px", display: "flex", alignItems: "center",
      justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100,
    },
    logo: { fontSize: 24, fontWeight: 800, color: "#e05c2a", letterSpacing: -1, cursor: "pointer" },
    cartBtn: {
      padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd",
      cursor: "pointer", fontSize: 14, fontWeight: 600,
      background: "#fff", color: "#444", position: "relative" as const,
    },
    nav: { display: "flex", gap: 8, alignItems: "center" },
    navBtn: {
      padding: "8px 16px", borderRadius: 8, border: "none",
      cursor: "pointer", fontSize: 14, fontWeight: 500,
      background: "transparent", color: "#444",
    },
    navBtnActive: {
      padding: "8px 16px", borderRadius: 8, border: "none",
      cursor: "pointer", fontSize: 14, fontWeight: 600,
      background: "#f0ede8", color: "#e05c2a",
    },
    primaryBtn: {
      padding: "10px 20px", borderRadius: 8, border: "none",
      cursor: "pointer", fontSize: 14, fontWeight: 600,
      background: "#e05c2a", color: "#fff",
    },
    secondaryBtn: {
      padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd",
      cursor: "pointer", fontSize: 14, fontWeight: 500,
      background: "#fff", color: "#444",
    },
    dangerBtn: {
      padding: "6px 12px", borderRadius: 6, border: "none",
      cursor: "pointer", fontSize: 13, fontWeight: 500,
      background: "#fee2e2", color: "#b91c1c",
    },
    warnBtn: {
      padding: "6px 12px", borderRadius: 6, border: "none",
      cursor: "pointer", fontSize: 13, fontWeight: 500,
      background: "#fef3c7", color: "#92400e",
    },
    main: { maxWidth: 1100, margin: "0 auto", padding: "32px 16px" },
    authCard: {
      maxWidth: 400, margin: "60px auto", background: "#fff",
      borderRadius: 16, padding: 36, boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
    },
    authTitle: { fontSize: 24, fontWeight: 700, marginBottom: 24, textAlign: "center" },
    input: {
      width: "100%", padding: "10px 12px", borderRadius: 8,
      border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box",
      marginBottom: 12, outline: "none",
    },
    textarea: {
      width: "100%", padding: "10px 12px", borderRadius: 8,
      border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box",
      marginBottom: 12, outline: "none", resize: "vertical", minHeight: 100,
    },
    select: {
      width: "100%", padding: "10px 12px", borderRadius: 8,
      border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box",
      marginBottom: 12, outline: "none", background: "#fff",
    },
    label: { fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4, display: "block" },
    error: { color: "#b91c1c", fontSize: 13, marginBottom: 8 },
    success: { color: "#15803d", fontSize: 13, marginBottom: 8 },
    sectionTitle: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      gap: 20,
    },
    card: {
      background: "#fff", borderRadius: 14, overflow: "hidden",
      boxShadow: "0 1px 6px rgba(0,0,0,0.07)", cursor: "pointer",
      transition: "transform 0.15s, box-shadow 0.15s",
    },
    cardImg: { width: "100%", height: 180, objectFit: "cover", display: "block", background: "#f0ede8" },
    cardImgPlaceholder: {
      width: "100%", height: 180, background: "#f0ede8",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 40,
    },
    cardBody: { padding: "12px 14px 14px" },
    cardTitle: { fontWeight: 600, fontSize: 15, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    cardPrice: { fontSize: 18, fontWeight: 700, color: "#e05c2a" },
    cardMeta: { fontSize: 12, color: "#888", marginTop: 4 },
    catBar: {
      display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24,
    },
    catChip: {
      padding: "6px 14px", borderRadius: 20, border: "1px solid #ddd",
      cursor: "pointer", fontSize: 13, fontWeight: 500,
      background: "#fff", color: "#444",
    },
    catChipActive: {
      padding: "6px 14px", borderRadius: 20, border: "1px solid #e05c2a",
      cursor: "pointer", fontSize: 13, fontWeight: 600,
      background: "#e05c2a", color: "#fff",
    },
    modal: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 16,
    },
    modalBox: {
      background: "#fff", borderRadius: 16, maxWidth: 640,
      width: "100%", maxHeight: "90vh", overflowY: "auto",
      padding: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
    },
    badge: {
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      fontSize: 11, fontWeight: 600, textTransform: "capitalize" as const,
    },
    infoBox: {
      background: "#fef9f0", border: "1px solid #f5c87c",
      borderRadius: 10, padding: 16, marginBottom: 24,
    },
    sellerBanner: {
      background: "#fff4ec", border: "1px solid #f5c87c",
      borderRadius: 10, padding: 16, marginBottom: 24,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const,
    },
    photoRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 },
    photoThumb: { position: "relative" as const, width: 80, height: 80 },
    photoThumbImg: { width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #eee" },
    photoRemove: {
      position: "absolute" as const, top: -6, right: -6,
      width: 20, height: 20, borderRadius: "50%", background: "#ef4444",
      color: "#fff", border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700,
    },
    myListingRow: {
      background: "#fff", borderRadius: 12, padding: "14px 16px",
      marginBottom: 12, display: "flex", alignItems: "center", gap: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    },
    myListingThumb: { width: 64, height: 64, objectFit: "cover", borderRadius: 8, background: "#f0ede8", flexShrink: 0 },
  };

  function sellerName(email: string): string {
    const p = sellerProfiles[email];
    if (p && p.display_name && p.display_name.trim()) return p.display_name.trim();
    // Obscure the raw email for privacy: show only the part before @
    return email.split("@")[0];
  }

  function conditionColor(c: string) {
    const map: Record<string, string> = {
      new: "#dcfce7", like_new: "#d1fae5", good: "#dbeafe", fair: "#fef9c3", poor: "#fee2e2",
    };
    return map[c] || "#e5e7eb";
  }

  function conditionLabel(c: string) {
    return CONDITIONS.find((x) => x.value === c)?.label || c;
  }

  function formatPrice(cents: number) {
    return "$" + (cents / 100).toFixed(2);
  }

  // ─── Email Verification Gate ───────────────────────────────────────────────
  if (verifyOpen) {
    return (
      <div style={s.root}>
        <div style={s.header}>
          <span style={s.logo} className="bazaar-logo">Bazaar</span>
        </div>
        <div style={s.authCard}>
          <div style={{ textAlign: "center", fontSize: 40, marginBottom: 12 }}>📬</div>
          <div style={{ ...s.authTitle as React.CSSProperties, marginBottom: 8 }}>Verify your email</div>
          <p style={{ fontSize: 14, color: "#666", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
            Enter the 6-digit code for <strong>{verifyEmail}</strong>.
          </p>

          {/* Dev-mode token display */}
          {verifyDevToken && (
            <div style={{
              background: "#fef9c3", border: "1px solid #fde68a",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20, textAlign: "center",
            }}>
              <div style={{
                display: "inline-block", background: "#fff4ec", border: "1px solid #f5c87c",
                borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#92400e",
                fontWeight: 600, marginBottom: 8,
              }}>
                ⚠️ Dev mode — no email service configured. Code shown here instead.
              </div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Your verification code (copy this):</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 8, color: "#166534", fontFamily: "monospace" }}>
                {verifyDevToken}
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Valid for 30 minutes</div>
            </div>
          )}

          <form onSubmit={handleVerify}>
            <label style={s.label}>Verification Code *</label>
            <input
              style={{ ...s.input, fontFamily: "monospace", letterSpacing: 6, fontSize: 22, textAlign: "center", textTransform: "uppercase" }}
              type="text"
              required
              maxLength={6}
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              autoFocus
            />
            {verifyError && <div style={s.error}>{verifyError}</div>}
            {verifyResent && <div style={s.success}>New code generated above!</div>}
            <button
              style={{ ...s.primaryBtn, width: "100%", padding: "12px 0", fontSize: 15 }}
              disabled={verifyLoading}
            >
              {verifyLoading ? "Verifying…" : "Verify Email →"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <span style={{ fontSize: 13, color: "#888" }}>Didn&apos;t get a code? </span>
            <button
              type="button"
              style={{ background: "none", border: "none", color: "#e05c2a", cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}
              onClick={handleResendVerify}
            >
              Resend code
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              type="button"
              style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 12 }}
              onClick={() => { setVerifyOpen(false); setAuthPassword(""); }}
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Auth Page ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={s.root}>
        <div style={s.header}>
          <span style={s.logo} className="bazaar-logo">Bazaar</span>
        </div>
        <div style={s.authCard}>
          <div style={s.authTitle as React.CSSProperties}>
            {authMode === "login" ? "Sign in to Bazaar" : "Create your account"}
          </div>
          <form onSubmit={handleAuth}>
            {authMode === "signup" && (
              <>
                <label style={s.label}>Your Name *</label>
                <input
                  style={s.input} type="text" value={authDisplayName} required
                  onChange={(e) => setAuthDisplayName(e.target.value)}
                  placeholder="Jane Smith"
                  maxLength={80}
                />
              </>
            )}

            <label style={s.label}>Email *</label>
            <input
              style={s.input} type="email" value={authEmail} required
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <label style={s.label}>Password *</label>
            <input
              style={s.input} type="password" value={authPassword} required
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />

            {authMode === "signup" && (
              <>
                <label style={s.label}>Confirm Password *</label>
                <input
                  style={s.input} type="password" value={authPasswordConfirm} required
                  onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />

                <label style={s.label}>I want to…</label>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  {(["buyer", "seller"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAuthRole(r)}
                      style={{
                        flex: 1, padding: "12px 8px", borderRadius: 10,
                        border: authRole === r ? "2px solid #e05c2a" : "2px solid #e5e5e5",
                        background: authRole === r ? "#fff4ec" : "#fff",
                        cursor: "pointer", fontWeight: 600, fontSize: 14,
                        color: authRole === r ? "#e05c2a" : "#555",
                      }}
                    >
                      {r === "buyer" ? "🛒 Buy" : "🏪 Sell"}
                      <div style={{ fontSize: 11, fontWeight: 400, color: "#888", marginTop: 3 }}>
                        {r === "buyer" ? "Shop the marketplace" : "List items for sale"}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {authError && <div style={s.error}>{authError}</div>}
            <button style={{ ...s.primaryBtn, width: "100%", marginTop: 4, padding: "12px 0", fontSize: 15 }} disabled={authLoading}>
              {authLoading ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div style={{ margin: "18px 0 4px", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
              <span style={{ fontSize: 12, color: "#bbb", whiteSpace: "nowrap" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
            </div>
            <button
              type="button"
              disabled
              title="Google OAuth requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — not configured in this environment"
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8,
                border: "1px solid #e5e5e5", background: "#fafafa",
                color: "#bbb", fontSize: 14, fontWeight: 500,
                cursor: "not-allowed", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.1 33.9 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.1 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.2-2.7-.5-4z"/>
                <path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 6 1.1 8.1 3l6-6C34.6 5.1 29.6 3 24 3 16.2 3 9.4 7.9 6.3 14.7z"/>
                <path fill="#FBBC05" d="M24 45c5.5 0 10.5-1.9 14.3-5l-6.6-5.4C29.8 36.4 27 37 24 37c-5.6 0-10.3-3.2-12.1-7.8l-7 5.4C8.5 41.5 15.7 45 24 45z"/>
                <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.4-2.4 4.4-4.4 5.8l6.6 5.4C41.8 36.2 45 30.6 45 24c0-1.3-.2-2.7-.5-4z"/>
              </svg>
              Continue with Google (not configured)
            </button>
          </div>

          <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#666" }}>
            {authMode === "login" ? "No account? " : "Already have one? "}
            <button
              style={{ background: "none", border: "none", color: "#e05c2a", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setAuthError("");
                setAuthPasswordConfirm("");
              }}
            >
              {authMode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>

          {authMode === "login" && (
            <p style={{ textAlign: "center", marginTop: 8, fontSize: 13, color: "#999" }}>
              <button
                style={{ background: "none", border: "none", color: "#e05c2a", cursor: "pointer", fontSize: 13, padding: 0 }}
                onClick={openForgot}
                type="button"
              >
                Forgot your password?
              </button>
            </p>
          )}
        </div>

        {/* ── Forgot-password modal ── */}
        {forgotOpen && (
          <div style={s.modal} onClick={(e) => { if (e.target === e.currentTarget) closeForgot(); }}>
            <div style={{ ...s.modalBox, maxWidth: 420 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {forgotStep === "request" ? "Reset your password" : "Enter your reset code"}
                </div>
                <button
                  onClick={closeForgot}
                  style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888", lineHeight: 1 }}
                >×</button>
              </div>

              {forgotStep === "request" && (
                <form onSubmit={handleForgotRequest}>
                  <p style={{ fontSize: 14, color: "#666", marginBottom: 18, lineHeight: 1.5 }}>
                    Enter your account email. We&apos;ll generate a one-time reset code valid for 15 minutes.
                  </p>
                  <label style={s.label}>Email *</label>
                  <input
                    style={s.input}
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                  />
                  {forgotError && <div style={s.error}>{forgotError}</div>}
                  {forgotSuccess && <div style={s.success}>{forgotSuccess}</div>}
                  <button
                    style={{ ...s.primaryBtn, width: "100%", padding: "11px 0", fontSize: 15 }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? "Please wait…" : "Send reset code"}
                  </button>
                </form>
              )}

              {forgotStep === "reset" && (
                <form onSubmit={handleForgotReset}>
                  <p style={{ fontSize: 14, color: "#666", marginBottom: 4, lineHeight: 1.5 }}>
                    A reset code was generated for <strong>{forgotEmail}</strong>.
                  </p>
                  {forgotToken && (
                    <div style={{
                      background: "#f0fdf4", border: "1px solid #86efac",
                      borderRadius: 10, padding: "12px 16px", marginBottom: 18,
                      textAlign: "center",
                    }}>
                      <div style={{
                        display: "inline-block", background: "#fef9c3", border: "1px solid #fde68a",
                        borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#92400e",
                        fontWeight: 600, marginBottom: 8,
                      }}>
                        ⚠️ Dev mode — no email service configured. Code shown here instead.
                      </div>
                      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Your reset code (copy this):</div>
                      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 6, color: "#166534", fontFamily: "monospace" }}>
                        {forgotToken}
                      </div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Valid for 15 minutes</div>
                    </div>
                  )}
                  {!forgotToken && forgotSuccess && (
                    <div style={{ ...s.success, marginBottom: 14 }}>{forgotSuccess}</div>
                  )}
                  <label style={s.label}>Reset Code *</label>
                  <input
                    style={{ ...s.input, fontFamily: "monospace", letterSpacing: 4, fontSize: 18, textTransform: "uppercase" }}
                    type="text"
                    required
                    value={forgotTokenInput}
                    onChange={(e) => setForgotTokenInput(e.target.value.toUpperCase())}
                    placeholder="XXXXXXXX"
                    maxLength={8}
                    autoFocus
                  />
                  <label style={s.label}>New Password *</label>
                  <input
                    style={s.input}
                    type="password"
                    required
                    minLength={6}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <label style={s.label}>Confirm New Password *</label>
                  <input
                    style={s.input}
                    type="password"
                    required
                    minLength={6}
                    value={forgotNewPasswordConfirm}
                    onChange={(e) => setForgotNewPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                  />
                  {forgotError && <div style={s.error}>{forgotError}</div>}
                  {forgotSuccess && <div style={{ ...s.success, fontWeight: 600 }}>{forgotSuccess}</div>}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      style={{ ...s.secondaryBtn, flex: 1 }}
                      onClick={() => { setForgotStep("request"); setForgotError(""); setForgotSuccess(""); }}
                    >
                      ← Back
                    </button>
                    <button
                      style={{ ...s.primaryBtn, flex: 2, padding: "11px 0", fontSize: 15 }}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? "Resetting…" : "Reset Password"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Main App ──────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.logo} className="bazaar-logo" onClick={() => { setView("browse"); setSelectedListing(null); }}>Bazaar</span>
        <div style={s.nav}>
          <button style={view === "browse" ? s.navBtnActive : s.navBtn} onClick={() => { setView("browse"); setSelectedListing(null); }}>
            Browse
          </button>
          <button style={view === "sell" ? s.navBtnActive : s.navBtn} onClick={() => setView("sell")}>
            Sell
          </button>
          <button style={view === "mylistings" ? s.navBtnActive : s.navBtn} onClick={() => setView("mylistings")}>
            My Listings
          </button>
          <button style={view === "watchlist" ? s.navBtnActive : s.navBtn} onClick={() => setView("watchlist")}>
            Watchlist{watchedIds.size > 0 ? ` (${watchedIds.size})` : ""}
          </button>
          <button style={view === "purchases" ? s.navBtnActive : s.navBtn} onClick={() => setView("purchases")}>
            Purchases{orders.length > 0 ? ` (${orders.length})` : ""}
          </button>
          <button style={view === "profile" ? s.navBtnActive : s.navBtn} onClick={() => setView("profile")}>
            Profile
          </button>
          <button
            style={{ ...s.cartBtn, color: cart.length > 0 ? "#e05c2a" : "#444", borderColor: cart.length > 0 ? "#e05c2a" : "#ddd" }}
            onClick={() => setCartOpen(true)}
          >
            🛒 Cart{cart.length > 0 ? ` (${cart.reduce((n, i) => n + i.quantity, 0)})` : ""}
          </button>
          <span style={{ fontSize: 13, color: "#888", marginLeft: 8 }}>{user.email}</span>
          <button style={s.secondaryBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </div>

      <div style={s.main}>

        {/* ── Browse ── */}
        {view === "browse" && !selectedListing && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Find something great</h1>
            <p style={{ color: "#666", marginBottom: 20 }}>Browse listings from sellers across the marketplace.</p>

            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 17, color: "#bbb", pointerEvents: "none", lineHeight: 1,
              }}>🔍</span>
              <input
                style={{
                  width: "100%", padding: "11px 44px 11px 42px", borderRadius: 10,
                  border: "1.5px solid #e0e0e0", fontSize: 15, boxSizing: "border-box",
                  outline: "none", background: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  transition: "border-color 0.15s",
                }}
                type="search"
                placeholder="Search listings by title or description…"
                value={searchQ}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchQ(v);
                  triggerSearch({ q: v, condition: filterCondition, minPrice: filterMinPrice, maxPrice: filterMaxPrice, categoryId: selectedCategory });
                }}
              />
              {searchQ && (
                <button
                  onClick={() => {
                    setSearchQ("");
                    triggerSearch({ q: "", condition: filterCondition, minPrice: filterMinPrice, maxPrice: filterMaxPrice, categoryId: selectedCategory });
                  }}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 18, color: "#bbb", lineHeight: 1, padding: 2,
                  }}
                  title="Clear search"
                >×</button>
              )}
            </div>

            {/* Main layout: sidebar + results */}
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

              {/* Filter sidebar */}
              <div style={{
                width: 200, flexShrink: 0,
                background: "#fff", borderRadius: 14,
                border: "1px solid #ebebeb",
                padding: "18px 16px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                position: "sticky", top: 76,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#333" }}>Filters</div>
                  {(selectedCategory !== null || filterCondition || filterMinPrice || filterMaxPrice) && (
                    <button
                      onClick={clearFilters}
                      style={{
                        background: "none", border: "none", color: "#e05c2a",
                        fontSize: 12, cursor: "pointer", fontWeight: 600, padding: 0,
                      }}
                    >Clear all</button>
                  )}
                </div>

                {/* Category */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    Category
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <button
                      onClick={() => {
                        setSelectedCategory(null);
                        triggerSearch({ q: searchQ, condition: filterCondition, minPrice: filterMinPrice, maxPrice: filterMaxPrice, categoryId: null });
                      }}
                      style={{
                        textAlign: "left", padding: "6px 10px", borderRadius: 7, border: "none",
                        cursor: "pointer", fontSize: 13, fontWeight: selectedCategory === null ? 700 : 400,
                        background: selectedCategory === null ? "#fff4ec" : "transparent",
                        color: selectedCategory === null ? "#e05c2a" : "#444",
                        transition: "background 0.12s",
                      }}
                    >All Categories</button>
                    {topCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCategory(c.id);
                          triggerSearch({ q: searchQ, condition: filterCondition, minPrice: filterMinPrice, maxPrice: filterMaxPrice, categoryId: c.id });
                        }}
                        style={{
                          textAlign: "left", padding: "6px 10px", borderRadius: 7, border: "none",
                          cursor: "pointer", fontSize: 13, fontWeight: selectedCategory === c.id ? 700 : 400,
                          background: selectedCategory === c.id ? "#fff4ec" : "transparent",
                          color: selectedCategory === c.id ? "#e05c2a" : "#444",
                          transition: "background 0.12s",
                        }}
                      >{c.name}</button>
                    ))}
                  </div>
                </div>

                {/* Condition */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    Condition
                  </div>
                  <select
                    value={filterCondition}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFilterCondition(v);
                      triggerSearch({ q: searchQ, condition: v, minPrice: filterMinPrice, maxPrice: filterMaxPrice, categoryId: selectedCategory });
                    }}
                    style={{
                      width: "100%", padding: "7px 10px", borderRadius: 7,
                      border: "1px solid #e0e0e0", fontSize: 13,
                      background: "#fff", outline: "none", color: "#333",
                    }}
                  >
                    <option value="">Any condition</option>
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Price range */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    Price Range
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Min"
                      value={filterMinPrice}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFilterMinPrice(v);
                        triggerSearch({ q: searchQ, condition: filterCondition, minPrice: v, maxPrice: filterMaxPrice, categoryId: selectedCategory });
                      }}
                      style={{
                        width: 0, flex: 1, padding: "7px 8px", borderRadius: 7,
                        border: "1px solid #e0e0e0", fontSize: 13, outline: "none",
                        background: "#fff",
                      }}
                    />
                    <span style={{ fontSize: 12, color: "#bbb", flexShrink: 0 }}>–</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Max"
                      value={filterMaxPrice}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFilterMaxPrice(v);
                        triggerSearch({ q: searchQ, condition: filterCondition, minPrice: filterMinPrice, maxPrice: v, categoryId: selectedCategory });
                      }}
                      style={{
                        width: 0, flex: 1, padding: "7px 8px", borderRadius: 7,
                        border: "1px solid #e0e0e0", fontSize: 13, outline: "none",
                        background: "#fff",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>Prices in USD ($)</div>
                </div>
              </div>

              {/* Results column */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Result count / active filters summary */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, minHeight: 24 }}>
                  <div style={{ fontSize: 13, color: "#888" }}>
                    {listingsLoading ? (
                      <span>Searching…</span>
                    ) : (
                      <span>
                        <strong style={{ color: "#333" }}>{listings.length}</strong>
                        {" result"}{listings.length !== 1 ? "s" : ""}
                        {(searchQ || filterCondition || filterMinPrice || filterMaxPrice || selectedCategory) && (
                          <span style={{ marginLeft: 6, color: "#bbb" }}>matching your filters</span>
                        )}
                      </span>
                    )}
                  </div>
                  {/* Active filter chips */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {searchQ && (
                      <span style={{ ...s.badge, background: "#f0ede8", color: "#c2410c", fontSize: 12, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                        "{searchQ}"
                        <button onClick={() => { setSearchQ(""); triggerSearch({ q: "", condition: filterCondition, minPrice: filterMinPrice, maxPrice: filterMaxPrice, categoryId: selectedCategory }); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#c2410c", padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    )}
                    {filterCondition && (
                      <span style={{ ...s.badge, background: "#f0ede8", color: "#c2410c", fontSize: 12, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                        {conditionLabel(filterCondition)}
                        <button onClick={() => { setFilterCondition(""); triggerSearch({ q: searchQ, condition: "", minPrice: filterMinPrice, maxPrice: filterMaxPrice, categoryId: selectedCategory }); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#c2410c", padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    )}
                    {(filterMinPrice || filterMaxPrice) && (
                      <span style={{ ...s.badge, background: "#f0ede8", color: "#c2410c", fontSize: 12, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                        {filterMinPrice ? `${filterMinPrice}` : "$0"} – {filterMaxPrice ? `${filterMaxPrice}` : "any"}
                        <button onClick={() => { setFilterMinPrice(""); setFilterMaxPrice(""); triggerSearch({ q: searchQ, condition: filterCondition, minPrice: "", maxPrice: "", categoryId: selectedCategory }); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#c2410c", padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    )}
                  </div>
                </div>

                {listingsLoading ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                    <div style={{ fontSize: 15 }}>Searching…</div>
                  </div>
                ) : listings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>No listings found</div>
                    <div style={{ fontSize: 14, marginTop: 4, marginBottom: 20, color: "#bbb" }}>
                      {(searchQ || filterCondition || filterMinPrice || filterMaxPrice || selectedCategory)
                        ? "Try adjusting your search or filters."
                        : "Be the first to list something!"}
                    </div>
                    {(searchQ || filterCondition || filterMinPrice || filterMaxPrice || selectedCategory) && (
                      <button style={s.secondaryBtn} onClick={clearFilters}>Clear all filters</button>
                    )}
                  </div>
                ) : (
                  <div style={s.grid}>
                    {listings.map((listing) => (
                      <div
                        key={listing.id}
                        style={s.card}
                        onClick={() => setSelectedListing(listing)}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform = "none";
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 6px rgba(0,0,0,0.07)";
                        }}
                      >
                        {listing.photos && listing.photos[0]
                          ? <img src={listing.photos[0]} alt={listing.title} style={s.cardImg as React.CSSProperties} />
                          : <div style={s.cardImgPlaceholder}>📦</div>
                        }
                        <div style={s.cardBody}>
                          <div style={s.cardTitle}>{listing.title}</div>
                          <div style={s.cardPrice}>{formatPrice(listing.price_cents)}</div>
                          <div style={s.cardMeta}>
                            <span
                              style={{ ...s.badge, background: conditionColor(listing.condition), color: "#333" }}
                            >{conditionLabel(listing.condition)}</span>
                            {" · "}{listing.category_name}
                          </div>
                          <div style={{ ...s.cardMeta, marginTop: 6 }}>
                            Seller: <strong>{sellerName(listing.seller_email)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Listing Detail ── */}
        {view === "browse" && selectedListing && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <button style={{ ...s.secondaryBtn, marginBottom: 20 }} onClick={() => setSelectedListing(null)}>
              ← Back to listings
            </button>
            {selectedListing.photos && selectedListing.photos.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 24, overflowX: "auto" }}>
                {selectedListing.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Photo ${i + 1}`}
                    style={{ width: 300, height: 240, objectFit: "cover", borderRadius: 12, flexShrink: 0 }}
                  />
                ))}
              </div>
            )}
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>{selectedListing.title}</h1>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#e05c2a", marginBottom: 12 }}>
              {formatPrice(selectedListing.price_cents)}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ ...s.badge, background: conditionColor(selectedListing.condition), color: "#333", fontSize: 13, padding: "4px 10px" }}>
                {conditionLabel(selectedListing.condition)}
              </span>
              <span style={{ ...s.badge, background: "#e8f0fe", color: "#1a56db", fontSize: 13, padding: "4px 10px" }}>
                {selectedListing.category_name}
              </span>
              <span style={{ ...s.badge, background: "#f0fdf4", color: "#166534", fontSize: 13, padding: "4px 10px" }}>
                Qty: {selectedListing.quantity}
              </span>
            </div>
            {selectedListing.description && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20, fontSize: 15, lineHeight: 1.6 }}>
                {selectedListing.description}
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Seller</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {sellerProfiles[selectedListing.seller_email]?.avatar_url && (
                  <img
                    src={sellerProfiles[selectedListing.seller_email].avatar_url}
                    alt="seller avatar"
                    style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #e5e5e5" }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{sellerName(selectedListing.seller_email)}</div>
                  <div style={{ fontSize: 12, color: "#bbb" }}>{selectedListing.seller_email}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
                Listed {new Date(selectedListing.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Watch / Add to cart */}
            {selectedListing.seller_email !== user.email && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" as const, marginBottom: 8 }}>
                <button
                  style={{
                    padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: watchLoading ? "default" : "pointer",
                    border: watchedIds.has(selectedListing.id) ? "2px solid #e05c2a" : "2px solid #ddd",
                    background: watchedIds.has(selectedListing.id) ? "#fff4ec" : "#fff",
                    color: watchedIds.has(selectedListing.id) ? "#e05c2a" : "#555",
                    transition: "all 0.15s",
                  }}
                  onClick={() => toggleWatch(selectedListing.id)}
                  disabled={watchLoading}
                >
                  {watchedIds.has(selectedListing.id) ? "♥ Watching" : "♡ Watch"}
                </button>
                <button
                  style={{
                    padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: "pointer", border: "2px solid #ddd",
                    background: "#fff", color: "#555", transition: "all 0.15s",
                  }}
                  onClick={() => openChat(selectedListing)}
                >
                  💬 Ask seller a question
                </button>
              </div>
            )}

            {/* Inline chat thread */}
            {chatOpen && chatListing?.id === selectedListing.id && (
              <div style={{
                background: "#fff", borderRadius: 14, border: "1px solid #e5e5e5",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginTop: 8, marginBottom: 8, overflow: "hidden",
              }}>
                <div style={{
                  background: "#f9f9f9", borderBottom: "1px solid #f0f0f0",
                  padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    💬 Chat with {sellerName(selectedListing.seller_email)}
                  </div>
                  <button
                    onClick={() => { setChatOpen(false); setChatMessages([]); }}
                    style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888", lineHeight: 1 }}
                  >×</button>
                </div>

                {/* Messages */}
                <div style={{ maxHeight: 320, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {chatLoading && chatMessages.length === 0 && (
                    <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "20px 0" }}>Loading messages…</div>
                  )}
                  {!chatLoading && chatMessages.length === 0 && (
                    <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "20px 0" }}>
                      No messages yet. Say hello!
                    </div>
                  )}
                  {chatMessages.map((msg) => {
                    const isMe = msg.sender_email === user.email;
                    return (
                      <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "78%", padding: "9px 14px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: isMe ? "#e05c2a" : "#f0ede8",
                          color: isMe ? "#fff" : "#111",
                          fontSize: 14, lineHeight: 1.5,
                        }}>
                          {msg.body}
                        </div>
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>
                          {isMe ? "You" : sellerName(msg.sender_email)} · {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendChatMessage} style={{ borderTop: "1px solid #f0f0f0", padding: "10px 14px", display: "flex", gap: 8 }}>
                  <input
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #ddd",
                      fontSize: 14, outline: "none",
                    }}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    disabled={chatSending}
                  />
                  <button
                    type="submit"
                    disabled={chatSending || !chatInput.trim()}
                    style={{
                      padding: "9px 18px", borderRadius: 8, border: "none",
                      background: "#e05c2a", color: "#fff", fontWeight: 600,
                      fontSize: 14, cursor: chatSending ? "default" : "pointer",
                      opacity: (!chatInput.trim() || chatSending) ? 0.5 : 1,
                    }}
                  >
                    {chatSending ? "…" : "Send"}
                  </button>
                </form>
              </div>
            )}
            {selectedListing.seller_email !== user.email && selectedListing.status === "active" && selectedListing.quantity > 0 && (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  style={{ ...s.primaryBtn, padding: "14px 32px", fontSize: 16 }}
                  onClick={() => { addToCart(selectedListing, 1); setCartOpen(true); }}
                >
                  🛒 Add to Cart
                </button>
                {addedToCart && (
                  <span style={{ color: "#15803d", fontWeight: 600, fontSize: 14 }}>✓ Added!</span>
                )}
              </div>
            )}
            {selectedListing.seller_email === user.email && (
              <div style={{ color: "#888", fontSize: 14, fontStyle: "italic" }}>This is your listing.</div>
            )}
            {selectedListing.status !== "active" && (
              <div style={{ color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>This listing is no longer available.</div>
            )}
          </div>
        )}

        {/* ── Cart Modal ── */}
        {cartOpen && (
          <div style={s.modal} onClick={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}>
            <div style={{ ...s.modalBox, maxWidth: 520 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Your Cart</div>
                <button
                  onClick={() => setCartOpen(false)}
                  style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#888", lineHeight: 1 }}
                >×</button>
              </div>

              {cart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🛒</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Your cart is empty</div>
                  <button
                    style={{ ...s.secondaryBtn, marginTop: 16 }}
                    onClick={() => setCartOpen(false)}
                  >Browse listings</button>
                </div>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.listing.id} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 0", borderBottom: "1px solid #f0f0f0",
                    }}>
                      {item.listing.photos?.[0]
                        ? <img src={item.listing.photos[0]} alt={item.listing.title}
                            style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                        : <div style={{ width: 60, height: 60, borderRadius: 8, background: "#f0ede8",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📦</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.listing.title}
                        </div>
                        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                          {formatPrice(item.listing.price_cents)} × {item.quantity}
                        </div>
                        <div style={{ fontSize: 12, color: "#aaa" }}>Seller: {item.listing.seller_email}</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#e05c2a", flexShrink: 0 }}>
                        {formatPrice(item.listing.price_cents * item.quantity)}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.listing.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc",
                          fontSize: 20, lineHeight: 1, flexShrink: 0, padding: "0 4px" }}
                        title="Remove"
                      >×</button>
                    </div>
                  ))}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginTop: 20, paddingTop: 16, borderTop: "2px solid #f0f0f0" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#888" }}>Total</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#e05c2a" }}>{formatPrice(cartTotal())}</div>
                    </div>
                    <button
                      style={{ ...s.primaryBtn, padding: "14px 28px", fontSize: 16 }}
                      onClick={() => { setCartOpen(false); openShippingModal(); }}
                      disabled={checkoutLoading}
                    >
                      Checkout →
                    </button>
                  </div>
                  {checkoutError && <div style={{ ...s.error, marginTop: 10 }}>{checkoutError}</div>}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Shipping Address Modal ── */}
        {shippingOpen && (
          <div style={s.modal} onClick={(e) => { if (e.target === e.currentTarget) setShippingOpen(false); }}>
            <div style={{ ...s.modalBox, maxWidth: 480 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>📦 Shipping Address</div>
                <button
                  onClick={() => setShippingOpen(false)}
                  style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888", lineHeight: 1 }}
                >×</button>
              </div>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 20, lineHeight: 1.5 }}>
                Enter the address where your items should be shipped. Sellers will see this to fulfill your order.
              </p>

              <label style={s.label}>Full Name *</label>
              <input
                style={s.input}
                value={shippingAddress.name}
                onChange={(e) => setShippingAddress((a) => ({ ...a, name: e.target.value }))}
                placeholder="Jane Smith"
              />

              <label style={s.label}>Address Line 1 *</label>
              <input
                style={s.input}
                value={shippingAddress.line1}
                onChange={(e) => setShippingAddress((a) => ({ ...a, line1: e.target.value }))}
                placeholder="123 Main St"
              />

              <label style={s.label}>Address Line 2</label>
              <input
                style={s.input}
                value={shippingAddress.line2}
                onChange={(e) => setShippingAddress((a) => ({ ...a, line2: e.target.value }))}
                placeholder="Apt 4B (optional)"
              />

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={s.label}>City *</label>
                  <input
                    style={s.input}
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress((a) => ({ ...a, city: e.target.value }))}
                    placeholder="New York"
                  />
                </div>
                <div>
                  <label style={s.label}>State *</label>
                  <input
                    style={s.input}
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress((a) => ({ ...a, state: e.target.value }))}
                    placeholder="NY"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label style={s.label}>ZIP *</label>
                  <input
                    style={s.input}
                    value={shippingAddress.zip}
                    onChange={(e) => setShippingAddress((a) => ({ ...a, zip: e.target.value }))}
                    placeholder="10001"
                    maxLength={10}
                  />
                </div>
              </div>

              <label style={s.label}>Country</label>
              <select
                style={s.select}
                value={shippingAddress.country}
                onChange={(e) => setShippingAddress((a) => ({ ...a, country: e.target.value }))}
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="JP">Japan</option>
                <option value="Other">Other</option>
              </select>

              {checkoutError && <div style={s.error}>{checkoutError}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  style={s.secondaryBtn}
                  onClick={() => { setShippingOpen(false); setCartOpen(true); }}
                >
                  ← Back to cart
                </button>
                <button
                  style={{ ...s.primaryBtn, flex: 1, padding: "12px 0", fontSize: 15 }}
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? "Redirecting to payment…" : "Continue to Payment →"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Sell ── */}
        {view === "sell" && (
          <>
            <h1 style={s.sectionTitle}>List an Item for Sale</h1>

            {/* Payout status banner */}
            {sellerStatus === null && (
              <div style={s.sellerBanner}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Set up payouts to start selling</div>
                  <div style={{ fontSize: 13, color: "#666" }}>Connect your bank account so buyers can pay you directly.</div>
                </div>
                <button style={s.primaryBtn} onClick={handleSetupPayouts} disabled={sellerLoading}>
                  {sellerLoading ? "Redirecting…" : "Set up payouts →"}
                </button>
              </div>
            )}

            {sellerStatus !== null && !sellerStatus.ready && (
              <div style={s.sellerBanner}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Finish setting up payouts</div>
                  <div style={{ fontSize: 13, color: "#666" }}>Your payout account isn&apos;t fully connected yet. Complete onboarding to list items.</div>
                </div>
                <button style={s.primaryBtn} onClick={handleSetupPayouts} disabled={sellerLoading}>
                  {sellerLoading ? "Redirecting…" : "Continue setup →"}
                </button>
              </div>
            )}

            {sellerStatus?.ready && (
              <div style={{ ...s.infoBox, background: "#f0fdf4", border: "1px solid #86efac" }}>
                <span style={{ color: "#166534", fontWeight: 600 }}>✓ Payouts connected</span>
                <span style={{ color: "#4ade80", margin: "0 8px" }}>·</span>
                <span style={{ fontSize: 13, color: "#555" }}>You&apos;re ready to sell!</span>
              </div>
            )}

            {sellerStatus?.ready ? (
              <form onSubmit={handleCreateListing} style={{ maxWidth: 560 }}>
                <label style={s.label}>Title *</label>
                <input
                  style={s.input} value={formTitle} required
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="What are you selling?"
                />

                <label style={s.label}>Description</label>
                <textarea
                  style={s.textarea} value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Describe the item, its condition, any flaws…"
                />

                <label style={s.label}>Category *</label>
                <select style={s.select} value={formCategory} onChange={(e) => setFormCategory(e.target.value === "" ? "" : Number(e.target.value))} required>
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.parent_id ? "  └ " : ""}{c.name}</option>
                  ))}
                </select>

                <label style={s.label}>Condition *</label>
                <select style={s.select} value={formCondition} onChange={(e) => setFormCondition(e.target.value)}>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={s.label}>Price ($) *</label>
                    <input
                      style={s.input} type="number" min="0.01" step="0.01" value={formPrice} required
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label style={s.label}>Quantity</label>
                    <input
                      style={s.input} type="number" min="1" value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                    />
                  </div>
                </div>

                <label style={s.label}>Photos</label>
                <div style={s.photoRow}>
                  {formPhotoUrls.map((url, i) => (
                    <div key={i} style={s.photoThumb}>
                      <img src={url} alt="" style={s.photoThumbImg as React.CSSProperties} />
                      <button type="button" style={s.photoRemove} onClick={() => removePhoto(i)}>×</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    style={{
                      width: 80, height: 80, borderRadius: 8, border: "2px dashed #ccc",
                      background: "#fafafa", cursor: "pointer", fontSize: 28, color: "#bbb",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >+</button>
                </div>
                <input
                  ref={fileInputRef} type="file" accept="image/*" multiple
                  style={{ display: "none" }} onChange={handlePhotoChange}
                />

                {formError && <div style={s.error}>{formError}</div>}
                {formSuccess && <div style={s.success}>{formSuccess}</div>}

                <button style={{ ...s.primaryBtn, width: "100%", padding: "12px 0", fontSize: 16 }} disabled={formLoading}>
                  {formLoading ? "Creating listing…" : "List Item"}
                </button>
              </form>
            ) : null}
          </>
        )}

        {/* ── Profile ── */}
        {view === "profile" && (
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <h1 style={s.sectionTitle}>Your Profile</h1>

            {/* Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
              <div
                style={{ position: "relative", width: 88, height: 88, flexShrink: 0, cursor: "pointer" }}
                onClick={() => avatarInputRef.current?.click()}
                title="Click to change avatar"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: "3px solid #e05c2a" }}
                  />
                ) : (
                  <div style={{
                    width: 88, height: 88, borderRadius: "50%", background: "#f0ede8",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36, border: "3px solid #e5e5e5",
                  }}>
                    👤
                  </div>
                )}
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 26, height: 26, borderRadius: "50%",
                  background: "#e05c2a", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, border: "2px solid #fff",
                }}>✏️</div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {profile.display_name || user.email}
                </div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{user.email}</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    ...s.badge,
                    background: profile.role === "seller" ? "#fff4ec" : "#e8f0fe",
                    color: profile.role === "seller" ? "#c2410c" : "#1a56db",
                    fontSize: 12, padding: "3px 10px",
                  }}>
                    {profile.role === "seller" ? "Seller" : "Buyer"}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileSave}>
              <label style={s.label}>Display Name</label>
              <input
                style={s.input}
                value={profile.display_name}
                onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                placeholder="How should we call you?"
                maxLength={80}
              />

              <label style={s.label}>Account Type</label>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                {(["buyer", "seller"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, role: r }))}
                    style={{
                      flex: 1, padding: "14px 0", borderRadius: 10,
                      border: profile.role === r ? "2px solid #e05c2a" : "2px solid #e5e5e5",
                      background: profile.role === r ? "#fff4ec" : "#fff",
                      cursor: "pointer", fontWeight: 600, fontSize: 15,
                      color: profile.role === r ? "#e05c2a" : "#555",
                      transition: "all 0.15s",
                    }}
                  >
                    {r === "buyer" ? "🛒 Buyer" : "🏪 Seller"}
                    <div style={{ fontSize: 11, fontWeight: 400, color: "#888", marginTop: 4 }}>
                      {r === "buyer" ? "Browse & purchase items" : "List items for sale"}
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ background: "#f6f6f4", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#666" }}>
                <strong>Email:</strong> {user.email}
                {profile.role === "seller" && sellerStatus && !sellerStatus.ready && (
                  <div style={{ marginTop: 8, color: "#92400e" }}>
                    ⚠️ Payouts not set up yet —{" "}
                    <button
                      type="button"
                      style={{ background: "none", border: "none", color: "#e05c2a", cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}
                      onClick={handleSetupPayouts}
                    >
                      set up payouts
                    </button>
                  </div>
                )}
                {profile.role === "seller" && sellerStatus?.ready && (
                  <div style={{ marginTop: 8, color: "#166534" }}>✓ Payouts connected</div>
                )}
              </div>

              {profileError && <div style={s.error}>{profileError}</div>}
              {profileSaved && <div style={s.success}>Profile saved!</div>}

              <button
                style={{ ...s.primaryBtn, width: "100%", padding: "12px 0", fontSize: 16 }}
                disabled={profileLoading}
              >
                {profileLoading ? "Saving…" : "Save Profile"}
              </button>
            </form>
          </div>
        )}

        {/* ── Watchlist ── */}
        {view === "watchlist" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={s.sectionTitle}>Your Watchlist</h1>
              <span style={{ fontSize: 13, color: "#888" }}>
                {watchedIds.size} item{watchedIds.size !== 1 ? "s" : ""} saved
              </span>
            </div>

            {watchedListings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>♡</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Nothing saved yet</div>
                <div style={{ fontSize: 14, marginTop: 4, marginBottom: 20 }}>
                  Hit the ♡ Watch button on any listing to save it here.
                </div>
                <button
                  style={s.primaryBtn}
                  onClick={() => { setView("browse"); setSelectedListing(null); }}
                >
                  Browse listings
                </button>
              </div>
            ) : (
              <div style={s.grid}>
                {watchedListings.map((listing) => (
                  <div key={listing.id} style={{ ...s.card, position: "relative" }}>
                    {/* Unwatch button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWatch(listing.id); }}
                      disabled={watchLoading}
                      title="Remove from watchlist"
                      style={{
                        position: "absolute", top: 10, right: 10, zIndex: 2,
                        width: 32, height: 32, borderRadius: "50%",
                        border: "none", background: "rgba(255,255,255,0.9)",
                        cursor: "pointer", fontSize: 16, lineHeight: 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                        color: "#e05c2a",
                      }}
                    >
                      ♥
                    </button>

                    {/* Card body — clicking opens detail */}
                    <div
                      onClick={() => { setSelectedListing(listing); setView("browse"); }}
                      style={{ cursor: "pointer" }}
                    >
                      {listing.photos && listing.photos[0]
                        ? <img src={listing.photos[0]} alt={listing.title} style={s.cardImg as React.CSSProperties} />
                        : <div style={s.cardImgPlaceholder}>📦</div>
                      }
                      <div style={s.cardBody}>
                        <div style={s.cardTitle}>{listing.title}</div>
                        <div style={s.cardPrice}>{formatPrice(listing.price_cents)}</div>
                        <div style={s.cardMeta}>
                          <span style={{ ...s.badge, background: conditionColor(listing.condition), color: "#333" }}>
                            {conditionLabel(listing.condition)}
                          </span>
                          {" · "}{listing.category_name}
                        </div>
                        <div style={{ ...s.cardMeta, marginTop: 6 }}>
                          Seller: <strong>{sellerName(listing.seller_email)}</strong>
                        </div>
                        {listing.status !== "active" && (
                          <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
                            ⚠ No longer available
                          </div>
                        )}
                        {listing.quantity < 3 && listing.status === "active" && (
                          <div style={{ marginTop: 6, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                            Only {listing.quantity} left!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add to cart strip */}
                    {listing.status === "active" && listing.quantity > 0 && listing.seller_email !== user.email && (
                      <div style={{ padding: "0 14px 14px" }}>
                        <button
                          style={{ ...s.primaryBtn, width: "100%", padding: "9px 0", fontSize: 13 }}
                          onClick={(e) => { e.stopPropagation(); addToCart(listing, 1); setCartOpen(true); }}
                        >
                          🛒 Add to Cart
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Purchases ── */}
        {view === "purchases" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={s.sectionTitle}>Your Purchases</h1>
              {ordersLoading && <span style={{ fontSize: 13, color: "#888" }}>Loading…</span>}
            </div>

            {orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>No purchases yet</div>
                <div style={{ fontSize: 14, marginTop: 4, marginBottom: 20 }}>
                  When you buy something it will appear here.
                </div>
                <button style={s.primaryBtn} onClick={() => setView("browse")}>Browse listings</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {orders.map((order) => (
                  <div key={order.id} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                    {/* Order header */}
                    <div style={{ background: "#f9f9f9", borderBottom: "1px solid #f0f0f0", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Order #{order.id}</span>
                        <span style={{ marginLeft: 12, fontSize: 12, color: "#888" }}>
                          {new Date(order.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 700, color: "#e05c2a", fontSize: 16 }}>{formatPrice(order.total_cents)}</span>
                        <span style={{
                          ...s.badge,
                          background: order.status === "paid" ? "#dcfce7" : order.status === "pending" ? "#fef9c3" : "#fee2e2",
                          color: order.status === "paid" ? "#166534" : order.status === "pending" ? "#92400e" : "#b91c1c",
                          fontSize: 12, padding: "3px 10px",
                        }}>
                          {order.status === "paid" ? "✓ Paid" : order.status}
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    <div style={{ padding: "0 20px" }}>
                      {order.items.map((item, idx) => (
                        <div key={idx} style={{ padding: "14px 0", borderBottom: idx < order.items.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.title_snapshot}</div>
                              <div style={{ fontSize: 12, color: "#888" }}>
                                Seller: {item.seller_email.split("@")[0]} · Qty: {item.quantity}
                              </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#333", flexShrink: 0 }}>
                              {formatPrice(item.unit_price_cents * item.quantity)}
                            </div>
                            <span style={{
                              ...s.badge,
                              background: item.status === "shipped" ? "#dbeafe" : "#e8f0fe",
                              color: item.status === "shipped" ? "#1e40af" : "#1a56db",
                              fontSize: 11, flexShrink: 0,
                            }}>
                              {item.status === "shipped" ? "🚚 Shipped" : item.status}
                            </span>
                          </div>
                          {/* Tracking info for buyer */}
                          {item.status === "shipped" && item.tracking_number && item.carrier && (
                            <div style={{
                              marginTop: 8, padding: "8px 12px", borderRadius: 8,
                              background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 13,
                            }}>
                              <span style={{ fontWeight: 600, color: "#1e40af", marginRight: 6 }}>🚚 Tracking:</span>
                              <span style={{ color: "#444", marginRight: 6 }}>{item.carrier}</span>
                              {(() => {
                                const num = item.tracking_number;
                                const carrier = item.carrier;
                                const urls: Record<string, string> = {
                                  UPS: `https://www.ups.com/track?tracknum=${num}`,
                                  USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`,
                                  FedEx: `https://www.fedex.com/fedextrack/?trknbr=${num}`,
                                  DHL: `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${num}`,
                                  Amazon: `https://www.amazon.com/progress-tracker/package/?ref=ppx_yo2ov_dt_b_track_package`,
                                };
                                const url = urls[carrier];
                                return url ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontFamily: "monospace", color: "#1e40af", fontWeight: 700, textDecoration: "underline" }}
                                  >
                                    {num}
                                  </a>
                                ) : (
                                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#333" }}>{num}</span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Shipping address */}
                    {order.shipping_address && order.shipping_address.line1 && (
                      <div style={{ background: "#fef9f0", borderTop: "1px solid #f5e8d0", padding: "12px 20px", fontSize: 13, color: "#555" }}>
                        <span style={{ fontWeight: 600, color: "#92400e", marginRight: 8 }}>📦 Ships to:</span>
                        {order.shipping_address.name && <span>{order.shipping_address.name}, </span>}
                        {order.shipping_address.line1}
                        {order.shipping_address.line2 && `, ${order.shipping_address.line2}`}
                        , {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
                        {order.shipping_address.country && order.shipping_address.country !== "US" && `, ${order.shipping_address.country}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── My Listings ── */}
        {view === "mylistings" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h1 style={s.sectionTitle}>My Listings</h1>
              <button style={s.primaryBtn} onClick={() => setView("sell")}>+ New Listing</button>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #f0f0f0", paddingBottom: 0 }}>
              {(["listings", "orders", "messages"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setMyListingsTab(tab);
                    if (tab === "messages") { setActiveThread(null); fetchSellerThreads(); }
                  }}
                  style={{
                    padding: "8px 20px", border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: myListingsTab === tab ? 700 : 500,
                    background: "transparent",
                    color: myListingsTab === tab ? "#e05c2a" : "#888",
                    borderBottom: myListingsTab === tab ? "2px solid #e05c2a" : "2px solid transparent",
                    marginBottom: -2,
                  }}
                >
                  {tab === "listings"
                    ? `My Items (${myListings.length})`
                    : tab === "orders"
                    ? `Incoming Orders (${sellerOrders.length})`
                    : `Messages (${sellerThreads.length})`}
                </button>
              ))}
            </div>

            {myListingsTab === "listings" && (
              myListings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>No listings yet</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>
                    <button style={{ ...s.primaryBtn, marginTop: 12 }} onClick={() => setView("sell")}>
                      Create your first listing
                    </button>
                  </div>
                </div>
              ) : (
                myListings.map((listing) => (
                  <div key={listing.id} style={s.myListingRow}>
                    {listing.photos && listing.photos[0]
                      ? <img src={listing.photos[0]} alt={listing.title} style={s.myListingThumb as React.CSSProperties} />
                      : <div style={{ ...s.myListingThumb, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📦</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {listing.title}
                      </div>
                      <div style={{ fontSize: 13, color: "#888" }}>
                        {formatPrice(listing.price_cents)} · {conditionLabel(listing.condition)} · {listing.category_name}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{
                          ...s.badge,
                          background: listing.status === "active" ? "#dcfce7" : listing.status === "paused" ? "#fef9c3" : "#fee2e2",
                          color: listing.status === "active" ? "#166534" : listing.status === "paused" ? "#92400e" : "#b91c1c",
                        }}>
                          {listing.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {listing.status !== "removed" && (
                        <>
                          <button style={s.warnBtn} onClick={() => handlePauseResume(listing)}>
                            {listing.status === "active" ? "Pause" : "Resume"}
                          </button>
                          <button style={s.dangerBtn} onClick={() => handleRemoveListing(listing)}>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )
            )}

            {myListingsTab === "orders" && (
              sellerOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>No orders yet</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>When buyers purchase your items, orders appear here.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {sellerOrders.map((item) => (
                    <div key={item.id} style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{item.title_snapshot}</span>
                          <span style={{ marginLeft: 10, fontSize: 12, color: "#888" }}>
                            {new Date(item.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: "#e05c2a" }}>
                            {formatPrice(item.unit_price_cents * item.quantity)}
                          </span>
                          <span style={{ fontSize: 12, color: "#888" }}>× {item.quantity}</span>
                          <span style={{
                            ...s.badge,
                            background: item.status === "shipped" ? "#dbeafe" : "#dcfce7",
                            color: item.status === "shipped" ? "#1e40af" : "#166534",
                            fontSize: 11,
                          }}>
                            {item.status === "shipped" ? "🚚 Shipped" : item.status}
                          </span>
                        </div>
                      </div>

                      {/* Buyer shipping address */}
                      {item.shipping_address && item.shipping_address.line1 ? (
                        <div style={{ padding: "12px 18px", background: "#f9fffe", fontSize: 13 }}>
                          <div style={{ fontWeight: 600, color: "#0e7490", marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            📦 Ship to buyer
                          </div>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.shipping_address.name}</div>
                          <div style={{ color: "#444" }}>
                            {item.shipping_address.line1}
                            {item.shipping_address.line2 && <>, {item.shipping_address.line2}</>}
                          </div>
                          <div style={{ color: "#444" }}>
                            {item.shipping_address.city}, {item.shipping_address.state} {item.shipping_address.zip}
                            {item.shipping_address.country && item.shipping_address.country !== "US" && `, ${item.shipping_address.country}`}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>
                            Buyer: {item.buyer_email}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: "12px 18px", fontSize: 13, color: "#aaa" }}>
                          No shipping address provided · Buyer: {item.buyer_email}
                        </div>
                      )}

                      {/* Tracking info (already shipped) */}
                      {item.status === "shipped" && item.tracking_number && (
                        <div style={{ padding: "10px 18px", background: "#eff6ff", borderTop: "1px solid #bfdbfe", fontSize: 13 }}>
                          <span style={{ fontWeight: 600, color: "#1e40af", marginRight: 8 }}>🚚 Tracking:</span>
                          <span style={{ color: "#333", fontFamily: "monospace" }}>{item.carrier} — {item.tracking_number}</span>
                        </div>
                      )}

                      {/* Mark as Shipped section */}
                      {item.status !== "shipped" && (
                        <div style={{ padding: "10px 18px", borderTop: "1px solid #f5f5f5", background: "#fafafa" }}>
                          {shipSuccess[item.id] ? (
                            <div style={{ color: "#166534", fontWeight: 600, fontSize: 13 }}>{shipSuccess[item.id]}</div>
                          ) : !shipOpen[item.id] ? (
                            <button
                              style={{
                                padding: "7px 16px", borderRadius: 7, border: "none",
                                background: "#1e40af", color: "#fff", fontWeight: 600,
                                fontSize: 13, cursor: "pointer",
                              }}
                              onClick={() => setShipOpen((prev) => ({ ...prev, [item.id]: true }))}
                            >
                              🚚 Mark as Shipped
                            </button>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "flex-end" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Carrier *</label>
                                  <select
                                    style={{
                                      padding: "7px 10px", borderRadius: 7, border: "1px solid #ddd",
                                      fontSize: 13, background: "#fff", outline: "none", minWidth: 130,
                                    }}
                                    value={shipCarrier[item.id] || ""}
                                    onChange={(e) => setShipCarrier((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  >
                                    <option value="">Select carrier…</option>
                                    <option value="UPS">UPS</option>
                                    <option value="USPS">USPS</option>
                                    <option value="FedEx">FedEx</option>
                                    <option value="DHL">DHL</option>
                                    <option value="Amazon">Amazon Logistics</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 160 }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Tracking Number *</label>
                                  <input
                                    style={{
                                      padding: "7px 10px", borderRadius: 7, border: "1px solid #ddd",
                                      fontSize: 13, outline: "none", fontFamily: "monospace",
                                    }}
                                    value={shipTracking[item.id] || ""}
                                    onChange={(e) => setShipTracking((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    placeholder="e.g. 1Z999AA10123456784"
                                  />
                                </div>
                                <button
                                  style={{
                                    padding: "7px 16px", borderRadius: 7, border: "none",
                                    background: "#1e40af", color: "#fff", fontWeight: 600,
                                    fontSize: 13, cursor: shipLoading[item.id] ? "default" : "pointer",
                                    opacity: shipLoading[item.id] ? 0.7 : 1, flexShrink: 0,
                                  }}
                                  disabled={shipLoading[item.id]}
                                  onClick={() => handleMarkShipped(item.id)}
                                >
                                  {shipLoading[item.id] ? "Saving…" : "Confirm Shipped"}
                                </button>
                                <button
                                  style={{
                                    padding: "7px 12px", borderRadius: 7, border: "1px solid #ddd",
                                    background: "#fff", color: "#888", fontSize: 13, cursor: "pointer", flexShrink: 0,
                                  }}
                                  onClick={() => setShipOpen((prev) => ({ ...prev, [item.id]: false }))}
                                >
                                  Cancel
                                </button>
                              </div>
                              {shipError[item.id] && (
                                <div style={{ color: "#b91c1c", fontSize: 12 }}>{shipError[item.id]}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {myListingsTab === "messages" && (
              sellerThreadsLoading && sellerThreads.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
                  <div style={{ fontSize: 15 }}>Loading messages…</div>
                </div>
              ) : sellerThreads.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>No messages yet</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>When buyers ask questions about your listings, they appear here.</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 20 }}>
                  {/* Thread list */}
                  <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {sellerThreads.map((thread) => (
                      <div
                        key={`${thread.listing_id}-${thread.other_email}`}
                        onClick={() => setActiveThread(thread)}
                        style={{
                          background: "#fff", borderRadius: 10,
                          border: activeThread?.listing_id === thread.listing_id && activeThread?.other_email === thread.other_email
                            ? "2px solid #e05c2a" : "1px solid #e5e5e5",
                          padding: "12px 14px", cursor: "pointer",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                          transition: "border 0.12s",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {thread.listing_title}
                        </div>
                        <div style={{ fontSize: 12, color: "#e05c2a", fontWeight: 600, marginBottom: 4 }}>
                          {thread.other_email.split("@")[0]}
                        </div>
                        {thread.messages.length > 0 && (
                          <div style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {thread.messages[thread.messages.length - 1].body}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Active thread */}
                  <div style={{ flex: 1, background: "#fff", borderRadius: 14, border: "1px solid #e5e5e5", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    {!activeThread ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#bbb", fontSize: 14 }}>
                        Select a conversation
                      </div>
                    ) : (
                      <>
                        <div style={{ background: "#f9f9f9", borderBottom: "1px solid #f0f0f0", padding: "12px 18px" }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{activeThread.listing_title}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                            Conversation with {activeThread.other_email}
                          </div>
                        </div>

                        <div style={{ flex: 1, maxHeight: 380, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                          {activeThread.messages.length === 0 && (
                            <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "20px 0" }}>No messages in this thread.</div>
                          )}
                          {activeThread.messages.map((msg) => {
                            const isMe = msg.sender_email === user.email;
                            return (
                              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                                <div style={{
                                  maxWidth: "78%", padding: "9px 14px",
                                  borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                  background: isMe ? "#e05c2a" : "#f0ede8",
                                  color: isMe ? "#fff" : "#111",
                                  fontSize: 14, lineHeight: 1.5,
                                }}>
                                  {msg.body}
                                </div>
                                <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>
                                  {isMe ? "You" : msg.sender_email.split("@")[0]} · {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                            );
                          })}
                          <div ref={threadBottomRef} />
                        </div>

                        <form onSubmit={sendThreadMessage} style={{ borderTop: "1px solid #f0f0f0", padding: "10px 14px", display: "flex", gap: 8 }}>
                          <input
                            style={{
                              flex: 1, padding: "9px 12px", borderRadius: 8,
                              border: "1px solid #ddd", fontSize: 14, outline: "none",
                            }}
                            value={threadInput}
                            onChange={(e) => setThreadInput(e.target.value)}
                            placeholder="Reply…"
                            disabled={threadSending}
                          />
                          <button
                            type="submit"
                            disabled={threadSending || !threadInput.trim()}
                            style={{
                              padding: "9px 18px", borderRadius: 8, border: "none",
                              background: "#e05c2a", color: "#fff", fontWeight: 600,
                              fontSize: 14, cursor: threadSending ? "default" : "pointer",
                              opacity: (!threadInput.trim() || threadSending) ? 0.5 : 1,
                            }}
                          >
                            {threadSending ? "…" : "Send"}
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>


    </div>
  );
}
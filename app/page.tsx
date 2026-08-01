"use client";

import { useEffect, useState, useRef } from "react";

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

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

  const [view, setView] = useState<"browse" | "sell" | "mylistings" | "profile">("browse");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

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

  useEffect(() => {
    checkAuth();
    fetchCategories();
    fetchListings(null);
  }, []);

  useEffect(() => {
    if (user) {
      fetchSellerStatus();
      fetchMyListings();
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    fetchListings(selectedCategory);
  }, [selectedCategory]);

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

  async function fetchListings(categoryId: number | null) {
    try {
      const url = categoryId ? `/api/listings?category=${categoryId}` : "/api/listings";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch {}
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
        setUser({ email: authEmail });
      }
    } catch {
      setAuthError("Network error");
    } finally {
      setAuthLoading(false);
    }
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
    setView("browse");
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
        fetchListings(selectedCategory);
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
    fetchListings(selectedCategory);
  }

  async function handleRemoveListing(listing: Listing) {
    if (!confirm("Remove this listing?")) return;
    await fetch("/api/my-listings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: listing.id, status: "removed" }),
    });
    fetchMyListings();
    fetchListings(selectedCategory);
  }

  const topCategories = categories.filter((c) => c.parent_id === null);

  // ─── Styles ───────────────────────────────────────────────────────────────

  const s: Record<string, React.CSSProperties> = {
    root: { fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f6f6f4", color: "#111" },
    header: {
      background: "#fff", borderBottom: "1px solid #e5e5e5",
      padding: "0 24px", display: "flex", alignItems: "center",
      justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100,
    },
    logo: { fontSize: 24, fontWeight: 800, color: "#e05c2a", letterSpacing: -1, cursor: "pointer" },
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

  // ─── Auth Page ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={s.root}>
        <div style={s.header}>
          <span style={s.logo}>Bazaar</span>
        </div>
        <div style={s.authCard}>
          <div style={s.authTitle as React.CSSProperties}>
            {authMode === "login" ? "Sign in" : "Create account"}
          </div>
          <form onSubmit={handleAuth}>
            <label style={s.label}>Email</label>
            <input
              style={s.input} type="email" value={authEmail} required
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <label style={s.label}>Password</label>
            <input
              style={s.input} type="password" value={authPassword} required
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••"
            />
            {authError && <div style={s.error}>{authError}</div>}
            <button style={{ ...s.primaryBtn, width: "100%", marginTop: 4 }} disabled={authLoading}>
              {authLoading ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#666" }}>
            {authMode === "login" ? "No account? " : "Already have one? "}
            <button
              style={{ background: "none", border: "none", color: "#e05c2a", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
              onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}
            >
              {authMode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ─── Main App ──────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.logo} onClick={() => { setView("browse"); setSelectedListing(null); }}>Bazaar</span>
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
          <button style={view === "profile" ? s.navBtnActive : s.navBtn} onClick={() => setView("profile")}>
            Profile
          </button>
          <span style={{ fontSize: 13, color: "#888", marginLeft: 8 }}>{user.email}</span>
          <button style={s.secondaryBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </div>

      <div style={s.main}>

        {/* ── Browse ── */}
        {view === "browse" && !selectedListing && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Find something great</h1>
            <p style={{ color: "#666", marginBottom: 24 }}>Browse listings from sellers across the marketplace.</p>

            {/* Category filter */}
            <div style={s.catBar}>
              <button
                style={selectedCategory === null ? s.catChipActive : s.catChip}
                onClick={() => setSelectedCategory(null)}
              >All</button>
              {topCategories.map((c) => (
                <button
                  key={c.id}
                  style={selectedCategory === c.id ? s.catChipActive : s.catChip}
                  onClick={() => setSelectedCategory(c.id)}
                >{c.name}</button>
              ))}
            </div>

            {listings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>No listings yet</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>Be the first to list something!</div>
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
                        Seller: <strong>{listing.seller_email}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedListing.seller_email}</div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                Listed {new Date(selectedListing.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {/* ── Sell ── */}
        {view === "sell" && (
          <>
            <h1 style={s.sectionTitle}>List an Item for Sale</h1>

            {/* Payout banner */}
            {sellerStatus && !sellerStatus.ready && (
              <div style={s.sellerBanner}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Set up payouts to start selling</div>
                  <div style={{ fontSize: 13, color: "#666" }}>You need to connect your bank account before listing items.</div>
                </div>
                <button style={s.primaryBtn} onClick={handleSetupPayouts} disabled={sellerLoading}>
                  {sellerLoading ? "Redirecting…" : "Set up payouts →"}
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
                <select style={s.select} value={formCategory} onChange={(e) => setFormCategory(Number(e.target.value) as number | "")} required>
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
            ) : (
              !sellerStatus && (
                <div style={{ color: "#888", fontSize: 14 }}>Loading seller status…</div>
              )
            )}
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

        {/* ── My Listings ── */}
        {view === "mylistings" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={s.sectionTitle}>My Listings</h1>
              <button style={s.primaryBtn} onClick={() => setView("sell")}>+ New Listing</button>
            </div>

            {myListings.length === 0 ? (
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
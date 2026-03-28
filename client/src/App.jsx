import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiUrl } from "./api.js";
import "./App.css";

const TOKEN_KEY = "promo_auth_token";
const USER_KEY = "promo_auth_user";
const ADMIN_TOKEN_KEY = "promo_admin_token";

function loadSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return { token: null, user: null };
    const user = JSON.parse(raw);
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function loadAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function postAuth(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Алдаа гарлаа.");
  return data;
}

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString("mn-MN", { maximumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("mn-MN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function AdminPage() {
  const [now, setNow] = useState(() => new Date());
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminToken, setAdminToken] = useState(() => loadAdminToken());
  const [adminTab, setAdminTab] = useState("overview");
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminDocs, setAdminDocs] = useState([]);
  const [adminDataLoading, setAdminDataLoading] = useState(false);
  const [adminDataError, setAdminDataError] = useState("");
  const [adminDataWarning, setAdminDataWarning] = useState("");
  const [wheelPrize, setWheelPrize] = useState("Gift card 3,000");
  const [wheelLoading, setWheelLoading] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelError, setWheelError] = useState("");
  const [wheelInfo, setWheelInfo] = useState("");
  const [wheelStats, setWheelStats] = useState({
    totalDocs: 0,
    usedCount: 0,
    remainingCount: 0,
  });
  const [wheelWinners, setWheelWinners] = useState([]);
  const [lastWinner, setLastWinner] = useState(null);
  const [wheelSpinDeg, setWheelSpinDeg] = useState(0);
  const [wheelAnimating, setWheelAnimating] = useState(false);
  const adminAuthed = Boolean(adminToken);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  function onAdminLogin(e) {
    e.preventDefault();
    setAdminError("");
    postAuth("/api/auth/admin/login", {
      username: adminUser,
      password: adminPass,
    })
      .then((data) => {
        if (!data.token) throw new Error("Админ токен олдсонгүй.");
        setAdminToken(data.token);
        saveAdminToken(data.token);
        setAdminTab("overview");
        setAdminDataError("");
      })
      .catch((err) => {
        setAdminToken(null);
        clearAdminToken();
        setAdminError(err.message || "Нэвтрэх амжилтгүй.");
      });
  }

  function onAdminLogout() {
    setAdminToken(null);
    clearAdminToken();
    setAdminUser("");
    setAdminPass("");
    setAdminUsers([]);
    setAdminDocs([]);
    setAdminDataError("");
    setAdminDataWarning("");
    setWheelError("");
    setWheelInfo("");
    setWheelWinners([]);
    setLastWinner(null);
    setWheelStats({ totalDocs: 0, usedCount: 0, remainingCount: 0 });
    setAdminTab("overview");
  }

  const fetchWheelData = useCallback((token) => {
    if (!token) return;
    setWheelLoading(true);
    setWheelError("");
    fetch(apiUrl("/api/admin/wheel"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Wheel дата ачаалж чадсангүй.");
        setWheelStats({
          totalDocs: Number(data.totalDocs ?? 0),
          usedCount: Number(data.usedCount ?? 0),
          remainingCount: Number(data.remainingCount ?? 0),
        });
        setWheelWinners(data.winners ?? []);
      })
      .catch((err) => {
        setWheelError(err.message || "Wheel дата ачаалж чадсангүй.");
        setWheelStats({ totalDocs: 0, usedCount: 0, remainingCount: 0 });
        setWheelWinners([]);
      })
      .finally(() => setWheelLoading(false));
  }, []);

  function onSpinWheel() {
    if (!adminToken || wheelSpinning || wheelAnimating) return;
    if (wheelStats.remainingCount <= 0) {
      setWheelError("Сугалах баримт үлдээгүй байна.");
      return;
    }
    setWheelSpinning(true);
    setWheelAnimating(true);
    setWheelError("");
    setWheelInfo("");
    const extraSpins = 4 + Math.floor(Math.random() * 3);
    const targetDeg = wheelSpinDeg + extraSpins * 360 + Math.floor(Math.random() * 360);
    setWheelSpinDeg(targetDeg);

    const spinPromise = fetch(apiUrl("/api/admin/wheel/spin"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ prize: wheelPrize }),
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data })));

    const minSpinMs = 2800;
    const started = Date.now();

    spinPromise
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Сугалаа эргүүлэхэд алдаа гарлаа.");
        const elapsed = Date.now() - started;
        const wait = Math.max(0, minSpinMs - elapsed);
        window.setTimeout(() => {
          setLastWinner(data.winner ?? null);
          setWheelInfo("Ялагч амжилттай сонгогдлоо.");
          fetchWheelData(adminToken);
          setWheelAnimating(false);
          setWheelSpinning(false);
        }, wait);
      })
      .catch((err) => {
        setWheelError(err.message || "Сугалаа эргүүлэхэд алдаа гарлаа.");
        setWheelAnimating(false);
        setWheelSpinning(false);
      });
  }

  useEffect(() => {
    if (!adminAuthed || !adminToken) return;
    let cancelled = false;
    setAdminDataLoading(true);
    setAdminDataError("");
    setAdminDataWarning("");
    fetch(apiUrl("/api/admin/overview"), {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(data.error || "Админ дата ачаалж чадсангүй.");
        setAdminUsers(data.users ?? []);
        setAdminDocs(data.documents ?? []);
        setAdminDataWarning(data.warning ?? "");
      })
      .catch((err) => {
        if (!cancelled) {
          setAdminUsers([]);
          setAdminDocs([]);
          setAdminDataWarning("");
          setAdminDataError(err.message || "Админ дата ачаалж чадсангүй.");
        }
      })
      .finally(() => {
        if (!cancelled) setAdminDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adminAuthed, adminToken]);

  useEffect(() => {
    if (!adminAuthed || !adminToken || adminTab !== "wheel") return;
    fetchWheelData(adminToken);
  }, [adminTab, adminAuthed, adminToken, fetchWheelData]);

  return (
    <div className="admin-page">
      <div className="admin-shell">
        {!adminAuthed ? (
          <section className="admin-login-card" aria-label="Админ нэвтрэх хэсэг">
            <h1 className="admin-title">Админ нэвтрэх</h1>
            <p className="admin-subtitle">/admin хуудас руу нэвтрэх эрх</p>
            <form className="admin-login-form" onSubmit={onAdminLogin}>
              <div className="field">
                <label htmlFor="admin-user">Нэвтрэх нэр</label>
                <input
                  id="admin-user"
                  type="text"
                  autoComplete="username"
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="admin-pass">Нууц үг</label>
                <input
                  id="admin-pass"
                  type="password"
                  autoComplete="current-password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="admin123"
                  required
                />
              </div>
              {adminError ? <p className="admin-login-error">{adminError}</p> : null}
              <button type="submit" className="submit-btn">
                Нэвтрэх
              </button>
            </form>
            <a className="admin-home-link" href="/">
              Нүүр хуудас руу буцах
            </a>
          </section>
        ) : (
          <>
            <header className="admin-header">
              <h1 className="admin-title">Админ хуудас</h1>
              <p className="admin-subtitle">Системийн ерөнхий хяналтын хэсэг</p>
            </header>

            <section className="admin-menu" aria-label="Админ цэс">
              <div className="admin-menu-tabs">
                <button
                  type="button"
                  className={`admin-menu-btn ${adminTab === "overview" ? "active" : ""}`}
                  onClick={() => setAdminTab("overview")}
                >
                  Ерөнхий
                </button>
                <button
                  type="button"
                  className={`admin-menu-btn ${adminTab === "users" ? "active" : ""}`}
                  onClick={() => setAdminTab("users")}
                >
                  Хэрэглэгчид
                </button>
                <button
                  type="button"
                  className={`admin-menu-btn ${adminTab === "documents" ? "active" : ""}`}
                  onClick={() => setAdminTab("documents")}
                >
                  Баримтууд
                </button>
                <button
                  type="button"
                  className={`admin-menu-btn ${adminTab === "wheel" ? "active" : ""}`}
                  onClick={() => setAdminTab("wheel")}
                >
                  Lucky Wheel
                </button>
              </div>
              <button type="button" className="admin-logout-btn" onClick={onAdminLogout}>
                Logout
              </button>
            </section>

            {adminTab === "overview" ? (
              <section className="admin-grid">
                <article className="admin-card">
                  <p className="admin-card-label">Одоогийн цаг</p>
                  <p className="admin-card-value">
                    {now.toLocaleTimeString("mn-MN", { hour12: false })}
                  </p>
                </article>
                <article className="admin-card">
                  <p className="admin-card-label">Өнөөдрийн огноо</p>
                  <p className="admin-card-value">
                    {now.toLocaleDateString("mn-MN", { dateStyle: "full" })}
                  </p>
                </article>
                <article className="admin-card">
                  <p className="admin-card-label">Нийт хэрэглэгч</p>
                  <p className="admin-card-value">{adminUsers.length}</p>
                </article>
                <article className="admin-card">
                  <p className="admin-card-label">Нийт баримт</p>
                  <p className="admin-card-value">{adminDocs.length}</p>
                </article>
              </section>
            ) : null}

            {adminTab === "users" ? (
              <section className="admin-panel">
                <h2 className="admin-panel-title">Бүх хэрэглэгч</h2>
                {adminDataLoading ? (
                  <p className="admin-panel-text">Дата ачаалж байна...</p>
                ) : adminDataError ? (
                  <p className="admin-panel-text admin-panel-error">{adminDataError}</p>
                ) : adminDataWarning ? (
                  <p className="admin-panel-text admin-panel-warning">{adminDataWarning}</p>
                ) : adminUsers.length === 0 ? (
                  <p className="admin-panel-text">Хэрэглэгч олдсонгүй.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Утас</th>
                          <th>И-мэйл</th>
                          <th>Нас</th>
                          <th>Бүртгэсэн огноо</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((u) => (
                          <tr key={u.id}>
                            <td>{u.phone}</td>
                            <td>{u.email}</td>
                            <td>{u.age}</td>
                            <td>{formatDate(u.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {adminTab === "documents" ? (
              <section className="admin-panel">
                <h2 className="admin-panel-title">Бүх баримт</h2>
                {adminDataLoading ? (
                  <p className="admin-panel-text">Дата ачаалж байна...</p>
                ) : adminDataError ? (
                  <p className="admin-panel-text admin-panel-error">{adminDataError}</p>
                ) : adminDataWarning ? (
                  <p className="admin-panel-text admin-panel-warning">{adminDataWarning}</p>
                ) : adminDocs.length === 0 ? (
                  <p className="admin-panel-text">Баримт олдсонгүй.</p>
                ) : (
                  <div className="admin-doc-grid">
                    {adminDocs.map((d) => (
                      <article className="admin-doc-card" key={d.id}>
                        <div className="admin-doc-image-wrap">
                          <img
                            src={d.imageUrl}
                            alt={d.docNumber}
                            className="admin-doc-image"
                          />
                        </div>
                        <p className="admin-doc-row">
                          <strong>Код:</strong> {d.docNumber}
                        </p>
                        <p className="admin-doc-row">
                          <strong>Үнэ:</strong> {formatMoney(d.price)} ₮
                        </p>
                        <p className="admin-doc-row">
                          <strong>Хэрэглэгч:</strong> {d.user?.phone ?? "-"}
                        </p>
                        <p className="admin-doc-row">
                          <strong>Огноо:</strong> {formatDate(d.createdAt)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {adminTab === "wheel" ? (
              <section className="admin-panel admin-panel--wheel">
                <div className="admin-wheel-head">
                  <h2 className="admin-panel-title">Lucky Wheel</h2>
                  <button
                    type="button"
                    className="admin-wheel-refresh"
                    disabled={wheelLoading || wheelAnimating}
                    onClick={() => fetchWheelData(adminToken)}
                  >
                    {wheelLoading ? "Шинэчилж байна..." : "Шинэчлэх"}
                  </button>
                </div>
                <p className="admin-panel-text admin-wheel-intro">
                  Бүх оруулсан баримтын дундаас санамсаргүйгээр нэгийг сонгоно. Сонгогдсон
                  ялагч нүүр хуудсын «Ялагчид» хэсэгт харагдана.
                </p>

                <div className="admin-wheel-stage">
                  <div className="admin-wheel-pointer" aria-hidden />
                  <div
                    className={`admin-wheel-disc ${wheelAnimating ? "admin-wheel-disc--spin" : ""}`}
                    style={{ transform: `rotate(${wheelSpinDeg}deg)` }}
                  />
                </div>

                <div className="admin-wheel-controls">
                  <div className="field">
                    <label htmlFor="wheel-prize">Шагналын нэр</label>
                    <input
                      id="wheel-prize"
                      type="text"
                      value={wheelPrize}
                      onChange={(e) => setWheelPrize(e.target.value)}
                      placeholder="Gift card 3,000"
                      disabled={wheelAnimating}
                    />
                  </div>
                  <button
                    type="button"
                    className="submit-btn admin-wheel-spin-btn"
                    disabled={
                      wheelLoading ||
                      wheelAnimating ||
                      wheelStats.remainingCount <= 0
                    }
                    onClick={onSpinWheel}
                  >
                    {wheelAnimating ? "Эргүүлж байна..." : "Эргүүлэх"}
                  </button>
                </div>
                <div className="admin-wheel-stats">
                  <p>
                    <span className="admin-wheel-stat-label">Нийт баримт</span>
                    <span className="admin-wheel-stat-num">{wheelStats.totalDocs}</span>
                  </p>
                  <p>
                    <span className="admin-wheel-stat-label">Сонгогдсон</span>
                    <span className="admin-wheel-stat-num">{wheelStats.usedCount}</span>
                  </p>
                  <p>
                    <span className="admin-wheel-stat-label">Үлдсэн</span>
                    <span className="admin-wheel-stat-num">{wheelStats.remainingCount}</span>
                  </p>
                </div>
                {wheelLoading && !wheelWinners.length ? (
                  <p className="admin-panel-text">Wheel мэдээлэл ачаалж байна...</p>
                ) : null}
                {wheelInfo ? (
                  <p className="admin-panel-text admin-wheel-success">{wheelInfo}</p>
                ) : null}
                {wheelError ? (
                  <p className="admin-panel-text admin-panel-error">{wheelError}</p>
                ) : null}
                {lastWinner && !wheelAnimating ? (
                  <div className="admin-wheel-last">
                    <p className="admin-wheel-last-title">Сүүлийн ялагч</p>
                    <p className="admin-doc-row">
                      <strong>Баримтын код:</strong> {lastWinner.docNumber}
                    </p>
                    <p className="admin-doc-row">
                      <strong>Холбоо барих:</strong> {lastWinner.contact}
                    </p>
                    <p className="admin-doc-row">
                      <strong>Шагнал:</strong> {lastWinner.prize}
                    </p>
                  </div>
                ) : null}

                <h3 className="admin-wheel-subtitle">Сүүлийн ялагчид</h3>
                {wheelWinners.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Огноо</th>
                          <th>Баримт код</th>
                          <th>Холбоо барих</th>
                          <th>Шагнал</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wheelWinners.map((w) => (
                          <tr key={w.id}>
                            <td>{formatDate(w.createdAt)}</td>
                            <td>{w.docNumber}</td>
                            <td>{w.contact}</td>
                            <td>{w.prize}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : !wheelLoading ? (
                  <p className="admin-panel-text">Одоогоор ялагч бүртгэгдээгүй байна.</p>
                ) : null}
              </section>
            ) : null}

            <section className="admin-panel">
              <a className="admin-home-link" href="/">
                Нүүр хуудас руу буцах
              </a>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const idNum = useId();
  const idPrice = useId();
  const idFile = useId();

  const [authTab, setAuthTab] = useState("login");
  const [session, setSession] = useState(() => loadSession());
  const [mainView, setMainView] = useState("form");
  const [guestView, setGuestView] = useState("home");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regAge, setRegAge] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);

  const [docNumber, setDocNumber] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [docSaving, setDocSaving] = useState(false);
  const [docMessage, setDocMessage] = useState(null);

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(null);
  const [fullViewDoc, setFullViewDoc] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [heroImageSrc, setHeroImageSrc] = useState("/image1.jpg");
  const [hiddenCarouselProducts, setHiddenCarouselProducts] = useState([]);
  const [homeWinners, setHomeWinners] = useState([]);
  const carouselProducts = Array.from({ length: 21 }, (_v, i) => `/product${i + 1}.png`);
  const visibleCarouselProducts = carouselProducts.filter(
    (src) => !hiddenCarouselProducts.includes(src)
  );
  const carouselTrackRef = useRef(null);
  const isAdminRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  const loggedIn = Boolean(session.token && session.user);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/winners"))
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(data.error || "Ялагчид ачаалахад алдаа гарлаа.");
        setHomeWinners(data.winners ?? []);
      })
      .catch(() => {
        if (!cancelled) setHomeWinners([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || mainView !== "documents" || !session.token) return;
    let cancelled = false;
    setDocsLoading(true);
    setDocsError(null);
    fetch(apiUrl("/api/documents"), {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(data.error || "Алдаа гарлаа.");
        setDocuments(data.documents ?? []);
      })
      .catch((err) => {
        if (!cancelled) setDocsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, mainView, session.token]);

  useEffect(() => {
    if (mainView !== "documents") setFullViewDoc(null);
  }, [mainView]);

  useEffect(() => {
    if (!fullViewDoc) return;
    function onKey(e) {
      if (e.key === "Escape") setFullViewDoc(null);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullViewDoc]);

  function onFileChange(e) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
  }

  async function onDeleteDocument(doc, e) {
    e.stopPropagation();
    e.preventDefault();
    if (!session.token || deletingId) return;
    if (
      !window.confirm("Энэ баримтыг устгахдаа итгэлтэй байна уу?")
    ) {
      return;
    }
    setDeletingId(doc.id);
    try {
      const res = await fetch(apiUrl(`/api/documents/${doc.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа гарлаа.");
      setDocuments((prev) => prev.filter((x) => x.id !== doc.id));
      setFullViewDoc((open) => (open?.id === doc.id ? null : open));
    } catch (err) {
      window.alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function onDocSubmit(e) {
    e.preventDefault();
    setDocMessage(null);
    if (!session.token) return;
    const num = docNumber.trim();
    if (!num) {
      setDocMessage({ type: "err", text: "Баримтын дугаар оруулна уу." });
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setDocMessage({ type: "err", text: "Үнэ зөв оруулна уу." });
      return;
    }
    if (!imageFile) {
      setDocMessage({ type: "err", text: "Зураг сонгоно уу." });
      return;
    }

    setDocSaving(true);
    try {
      const fd = new FormData();
      fd.append("docNumber", num);
      fd.append("price", String(priceNum));
      fd.append("image", imageFile);
      const res = await fetch(apiUrl("/api/documents"), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Хадгалахад алдаа гарлаа.");
      setDocMessage({ type: "ok", text: "Баримт хадгалагдлаа." });
      setDocNumber("");
      setPrice("");
      setImageFile(null);
    } catch (err) {
      setDocMessage({ type: "err", text: err.message });
    } finally {
      setDocSaving(false);
    }
  }

  async function onLogin(e) {
    e.preventDefault();
    setAuthMessage(null);
    setAuthLoading(true);
    try {
      const data = await postAuth("/api/auth/login", {
        phone: loginPhone,
        password: loginPassword,
      });
      saveSession(data.token, data.user);
      setSession({ token: data.token, user: data.user });
      setMainView("form");
      setLoginPassword("");
      setAuthMessage({ type: "ok", text: "Амжилттай нэвтэрлээ." });
    } catch (err) {
      setAuthMessage({ type: "err", text: err.message });
    } finally {
      setAuthLoading(false);
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    setAuthMessage(null);
    setAuthLoading(true);
    try {
      const data = await postAuth("/api/auth/register", {
        phone: regPhone,
        email: regEmail,
        age: regAge === "" ? NaN : Number(regAge),
        password: regPassword,
      });
      saveSession(data.token, data.user);
      setSession({ token: data.token, user: data.user });
      setMainView("form");
      setRegPassword("");
      setAuthMessage({ type: "ok", text: "Бүртгэл амжилттай. Нэвтэрлээ." });
    } catch (err) {
      setAuthMessage({ type: "err", text: err.message });
    } finally {
      setAuthLoading(false);
    }
  }

  function onLogout() {
    clearSession();
    setSession({ token: null, user: null });
    setAuthMessage(null);
    setMainView("form");
    setGuestView("home");
    setDocuments([]);
    setFullViewDoc(null);
    setDeletingId(null);
  }

  function scrollCarousel(direction) {
    const track = carouselTrackRef.current;
    if (!track) return;
    const delta = Math.max(220, Math.round(track.clientWidth * 0.75));
    track.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    const track = carouselTrackRef.current;
    if (!track || loggedIn || guestView !== "home") return;

    const timerId = window.setInterval(() => {
      const currentTrack = carouselTrackRef.current;
      if (!currentTrack) return;

      const maxScrollLeft = currentTrack.scrollWidth - currentTrack.clientWidth;
      if (maxScrollLeft <= 0) return;

      const delta = Math.max(220, Math.round(currentTrack.clientWidth * 0.75));
      const nextLeft = currentTrack.scrollLeft + delta;
      if (nextLeft >= maxScrollLeft - 4) {
        currentTrack.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        currentTrack.scrollTo({ left: nextLeft, behavior: "smooth" });
      }
    }, 2800);

    return () => window.clearInterval(timerId);
  }, [loggedIn, guestView, visibleCarouselProducts.length]);

  const showGuestAuth = !loggedIn && guestView === "auth";

  if (isAdminRoute) {
    return <AdminPage />;
  }

  return (
    <div className={`app-shell ${!loggedIn ? "app-shell--guest-hero" : ""}`}>
      <header className="site-header">
        <div
          className={`header-inner ${loggedIn ? "header-inner--auth" : "header-inner--guest"}`}
        >
          {loggedIn ? (
            <>
              <div
                className="header-user"
                role="region"
                aria-label="Хэрэглэгчийн мэдээлэл"
              >
                <div className="header-avatar" aria-hidden>
                  {String(session.user.phone).slice(-2) || "?"}
                </div>
                <div className="header-user-text">
                  <p className="header-greeting">
                    Тавтай морил,{" "}
                    <span className="header-phone">{session.user.phone}</span>
                  </p>
                  <p className="header-meta">
                    <span className="header-email">{session.user.email}</span>
                    <span className="header-dot" aria-hidden>
                      ·
                    </span>
                    <span className="header-age">Нас {session.user.age}</span>
                  </p>
                </div>
              </div>
              <div className="header-actions">
              {mainView === "form" ? (
                <button
                  type="button"
                  className="header-docs-btn"
                  onClick={() => setMainView("documents")}
                >
                  Баримтууд үзэх
                </button>
              ) : (
                <button
                  type="button"
                  className="header-back-btn"
                  onClick={() => setMainView("form")}
                >
                  Буцах
                </button>
              )}
              <button
                type="button"
                className="header-logout-btn"
                onClick={onLogout}
              >
                Гарах
              </button>
              </div>
            </>
          ) : (
            <>
              {guestView === "home" ? (
                <div className="guest-header-shell" aria-label="Нүүр цэс">
                  <div className="guest-header-top">
                    <div className="guest-header-left">
                      <img src="/logo1.png" alt="Лого 1" className="guest-top-logo" />
                      <img src="/logo2.png" alt="Лого 2" className="guest-top-logo" />
                    </div>
                    <div className="guest-header-right">
                      <button
                        type="button"
                        className="guest-header-btn"
                        onClick={() => {
                          setGuestView("auth");
                          setAuthTab("login");
                          setAuthMessage(null);
                        }}
                      >
                        Баримт оруулах
                      </button>
                    </div>
                  </div>
                  <nav className="guest-top-menu" aria-label="Нүүр цэс">
                    <a className="guest-top-menu-item" href="#home-top">
                      Үндсэн нүүр
                    </a>
                    <a className="guest-top-menu-item" href="#how-to-join">
                      Хэрхэн оролцох вэ?
                    </a>
                    <a className="guest-top-menu-item" href="#prize-pool-heading">
                      Шагналууд
                    </a>
                    <a className="guest-top-menu-item" href="#winners">
                      Ялагчид
                    </a>
                    <a className="guest-top-menu-item" href="#bonus-products-heading">
                      Урамшууллын бүтээгдэхүүнүүд
                    </a>
                  </nav>
                </div>
              ) : null}
            </>
          )}
        </div>
      </header>

      {!loggedIn && guestView === "home" ? (
        <section id="home-top" className="home-hero" aria-label="Нүүр баннер">
          <div className="home-hero-bg" aria-hidden />
          <div className="home-hero-rays" aria-hidden />
          <div className="home-hero-content">
            <img
              src={heroImageSrc}
              alt="Сугалааны аян баннер"
              className="home-board-image"
              onError={() => {
                if (heroImageSrc === "/image1.jpg") setHeroImageSrc("/image1.png");
              }}
            />
            <section id="how-to-join" className="campaign-section" aria-labelledby="how-join-title">
              <h2 id="how-join-title" className="home-prize-title">
                Хэрхэн оролцох вэ?
              </h2>
              <div className="how-steps-grid">
                <article className="how-step-card">
                  <span className="how-step-num">1</span>
                  <img src="/product1.png" alt="" className="how-step-image" />
                  <p className="how-step-title">Бүтээгдэхүүнээ авна</p>
                  <p className="how-step-text">2 эсвэл 20 ширхэг авалт хийнэ.</p>
                </article>
                <article className="how-step-card">
                  <span className="how-step-num">2</span>
                  <img
                    src={heroImageSrc}
                    alt=""
                    className="how-step-image"
                    onError={() => {
                      if (heroImageSrc === "/image1.jpg") setHeroImageSrc("/image1.png");
                    }}
                  />
                  <p className="how-step-title">Баримтаа бүртгэнэ</p>
                  <p className="how-step-text">Вэбсайт дээр баримтаа оруулна.</p>
                </article>
                <article className="how-step-card">
                  <span className="how-step-num">3</span>
                  <img src="/prize-ps5.png" alt="" className="how-step-image" />
                  <p className="how-step-title">Баталгаат шагнал</p>
                  <p className="how-step-text">Шагналаа шууд авах боломжтой.</p>
                </article>
                <article className="how-step-card">
                  <span className="how-step-num">4</span>
                  <img src="/prize-iphone17.png" alt="" className="how-step-image" />
                  <p className="how-step-title">Супер шагнал</p>
                  <p className="how-step-text">Ялагч болж том шагнал хожно.</p>
                </article>
              </div>
            </section>
            <section
              className="home-prize-pool campaign-section"
              aria-labelledby="prize-pool-heading"
            >
              <h2 id="prize-pool-heading" className="home-prize-title">
                ШАГНАЛЫН САН
              </h2>
              <div className="home-prize-grid">
                <article className="home-prize-card">
                  <img
                    src="/prize-electric-scooter.png"
                    alt="Electric Scooter"
                    className="home-prize-image"
                  />
                  <p className="home-prize-label">Electric Scooter</p>
                </article>
                <article className="home-prize-card">
                  <img
                    src="/prize-headphone.png"
                    alt="Headphone"
                    className="home-prize-image"
                  />
                  <p className="home-prize-label">Headphone</p>
                </article>
                <article className="home-prize-card">
                  <img
                    src="/prize-ps5.png"
                    alt="PS5"
                    className="home-prize-image"
                  />
                  <p className="home-prize-label">PS5</p>
                </article>
                <article className="home-prize-card">
                  <img
                    src="/prize-iphone17.png"
                    alt="Iphone17"
                    className="home-prize-image"
                  />
                  <p className="home-prize-label">Iphone17</p>
                </article>
                <article className="home-prize-card">
                  <img
                    src="/prize-jersey-argentina.png"
                    alt="Jersey Argentina"
                    className="home-prize-image"
                  />
                  <p className="home-prize-label">Jersey Argentina 20ш</p>
                </article>
                <article className="home-prize-card">
                  <img
                    src="/prize-soccer-ball.png"
                    alt="Soccer ball"
                    className="home-prize-image"
                  />
                  <p className="home-prize-label">Soccer ball 30ш</p>
                </article>
              </div>
            </section>
            <section
              className="home-bonus-products campaign-section"
              aria-labelledby="bonus-products-heading"
            >
              <h2 id="bonus-products-heading" className="home-prize-title">
                Урамшууллын бүтээгдэхүүнүүд
              </h2>
              <div className="home-carousel" role="region" aria-label="Бүтээгдэхүүний carousel">
                <button
                  type="button"
                  className="home-carousel-nav home-carousel-nav--left"
                  aria-label="Өмнөх бүтээгдэхүүнүүд"
                  onClick={() => scrollCarousel("left")}
                >
                  ‹
                </button>
                <div className="home-carousel-track" ref={carouselTrackRef}>
                  {visibleCarouselProducts.map((src, index) => (
                    <article className="home-carousel-card" key={src}>
                      <img
                        src={src}
                        alt={`Урамшууллын бүтээгдэхүүн ${index + 1}`}
                        className="home-carousel-image"
                        onError={() => {
                          setHiddenCarouselProducts((prev) =>
                            prev.includes(src) ? prev : [...prev, src]
                          );
                        }}
                      />
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="home-carousel-nav home-carousel-nav--right"
                  aria-label="Дараах бүтээгдэхүүнүүд"
                  onClick={() => scrollCarousel("right")}
                >
                  ›
                </button>
              </div>
            </section>
            <section id="winners" className="campaign-section winners-section" aria-labelledby="winners-title">
              <h2 id="winners-title" className="home-prize-title">
                Ялагчид
              </h2>
              <div className="winners-table-wrap">
                <table className="winners-table">
                  <thead>
                    <tr>
                      <th>Огноо</th>
                      <th>Баримт код</th>
                      <th>Холбоо барих</th>
                      <th>Шагнал</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homeWinners.length ? (
                      homeWinners.map((w) => (
                        <tr key={w.id}>
                          <td>{formatDate(w.createdAt)}</td>
                          <td>{w.docNumber}</td>
                          <td>{w.contact}</td>
                          <td>{w.prize}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>Одоогоор ялагч алга байна.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {showGuestAuth || loggedIn ? (
      <div className={`form-page ${!loggedIn ? "form-page--on-hero" : ""}`}>
        <div className="layout-stack">
          {showGuestAuth ? (
            <section className="card-form auth-card" aria-label="Нэвтрэх, бүртгэл">
              <button
                type="button"
                className="auth-back-btn"
                onClick={() => setGuestView("home")}
              >
                ← Нүүр хуудас
              </button>
              <div className="auth-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === "login"}
                  className={authTab === "login" ? "tab active" : "tab"}
                  onClick={() => {
                    setAuthTab("login");
                    setAuthMessage(null);
                  }}
                >
                  Нэвтрэх
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === "register"}
                  className={authTab === "register" ? "tab active" : "tab"}
                  onClick={() => {
                    setAuthTab("register");
                    setAuthMessage(null);
                  }}
                >
                  Бүртгүүлэх
                </button>
              </div>

              {authTab === "login" ? (
                <form className="auth-form" onSubmit={onLogin}>
                  <div className="field">
                    <label htmlFor="login-phone">Утасны дугаар</label>
                    <input
                      id="login-phone"
                      type="tel"
                      autoComplete="username"
                      required
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      placeholder="99119999"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="login-pass">Нууц үг</label>
                    <input
                      id="login-pass"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={authLoading}
                  >
                    {authLoading ? "Түр хүлээнэ үү…" : "Нэвтрэх"}
                  </button>
                </form>
              ) : (
                <form className="auth-form" onSubmit={onRegister}>
                  <div className="field">
                    <label htmlFor="reg-phone">Утасны дугаар (хэрэглэгчийн нэр)</label>
                    <input
                      id="reg-phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="99119999"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="reg-email">И-мэйл</label>
                    <input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="reg-age">Нас</label>
                    <input
                      id="reg-age"
                      type="number"
                      min={1}
                      max={120}
                      required
                      value={regAge}
                      onChange={(e) => setRegAge(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="reg-pass">Нууц үг</label>
                    <input
                      id="reg-pass"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                    <span className="field-hint">Хамгийн багадаа 6 тэмдэгт</span>
                  </div>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={authLoading}
                  >
                    {authLoading ? "Түр хүлээнэ үү…" : "Бүртгүүлэх"}
                  </button>
                </form>
              )}

              {authMessage && (
                <p className={`auth-msg ${authMessage.type}`}>{authMessage.text}</p>
              )}
            </section>
          ) : null}

          {loggedIn && mainView === "form" ? (
            <form className="card-form" onSubmit={onDocSubmit} noValidate>
              <h2 className="section-heading">Баримт бүртгэх</h2>
              <div className="field">
                <label htmlFor={idNum}>Баримтын дугаар</label>
                <input
                  id={idNum}
                  type="text"
                  autoComplete="off"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor={idPrice}>Үнэ</label>
                <input
                  id={idPrice}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="image-section">
                <p className="image-section-title">Баримтаа оруулна уу</p>
                <div className="file-row">
                  <input
                    id={idFile}
                    type="file"
                    accept="image/*"
                    className="file-input"
                    onChange={onFileChange}
                  />
                  <label htmlFor={idFile} className="file-label">
                    Файл сонгох
                  </label>
                </div>
                {previewUrl && (
                  <div className="preview-wrap">
                    <img src={previewUrl} alt="" className="preview-img" />
                  </div>
                )}
              </div>

              {docMessage && (
                <p className={`auth-msg ${docMessage.type}`}>{docMessage.text}</p>
              )}

              <button type="submit" className="submit-btn" disabled={docSaving}>
                {docSaving ? "Хадгалж байна…" : "Бүртгэх"}
              </button>
            </form>
          ) : null}

          {loggedIn && mainView === "documents" ? (
            <div className="documents-page card-form">
              <div className="documents-page-head">
                <h2 id="barimtuud-title" className="section-heading">
                  Миний баримтууд
                </h2>
                <p className="documents-page-lead">
                  Зөвхөн таны бүртгэсэн баримтууд харагдана.
                </p>
              </div>

              {docsLoading ? (
                <p className="documents-status">Ачаалж байна…</p>
              ) : docsError ? (
                <p className="documents-status documents-status-err">{docsError}</p>
              ) : documents.length === 0 ? (
                <p className="documents-empty">Одоогоор баримт байхгүй байна.</p>
              ) : (
                <ul className="doc-list">
                  {documents.map((d) => (
                    <li
                      key={d.id}
                      className="doc-card doc-card--clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => setFullViewDoc(d)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setFullViewDoc(d);
                        }
                      }}
                      aria-label={`${d.docNumber} — бүтэн зураг харах`}
                    >
                      <div className="doc-card-media">
                        <img src={d.imageUrl} alt="" className="doc-card-img" />
                      </div>
                      <div className="doc-card-body">
                        <p className="doc-card-number">{d.docNumber}</p>
                        <p className="doc-card-price">
                          Үнэ:{" "}
                          <strong>{formatMoney(d.price)} ₮</strong>
                        </p>
                        <p className="doc-card-date">{formatDate(d.createdAt)}</p>
                        <div className="doc-card-footer">
                          <p className="doc-card-hint">Дарж бүтэн харах</p>
                          <button
                            type="button"
                            className="doc-delete-btn"
                            disabled={deletingId === d.id}
                            aria-label="Устгах"
                            onClick={(e) => onDeleteDocument(d, e)}
                          >
                            {deletingId === d.id ? "Устгаж…" : "Устгах"}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
      ) : null}

      {fullViewDoc ? (
        <div
          className="lightbox-backdrop"
          role="presentation"
          onClick={() => setFullViewDoc(null)}
        >
          <div
            className="lightbox-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lightbox-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="lightbox-close"
              aria-label="Хаах"
              onClick={() => setFullViewDoc(null)}
            >
              ×
            </button>
            <div className="lightbox-img-wrap">
              <img
                src={fullViewDoc.imageUrl}
                alt=""
                className="lightbox-img"
              />
            </div>
            <div className="lightbox-meta">
              <p id="lightbox-title" className="lightbox-title">
                {fullViewDoc.docNumber}
              </p>
              <p className="lightbox-sub">
                Үнэ:{" "}
                <strong>{formatMoney(fullViewDoc.price)} ₮</strong>
              </p>
              <p className="lightbox-date">{formatDate(fullViewDoc.createdAt)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

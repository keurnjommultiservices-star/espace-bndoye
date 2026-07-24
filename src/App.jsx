import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Search, Play, Pencil, Trash2, Calendar,
  Clock, Tag, Link as LinkIcon, Check, ChevronLeft,
  FileText, Send, Eye, EyeOff, Lock, LogOut, AlertTriangle
} from "lucide-react";
import { isConfigured, fetchAll, upsertOne, deleteOne } from "./supabase.js";

/* ---------- constantes ---------- */

const THEMES = [
  "Foi & croyance", "Comportement (Akhlaq)", "Famille", "Patience",
  "Gratitude", "Justice sociale", "Ramadan", "Sermons des fêtes de Korité et de Tabaski",
  "Au-delà", "Autre",
];

const TYPES = [
  { id: "sermon", label: "Sermon du vendredi", plural: "Sermons du vendredi", short: "sermon" },
  { id: "conference", label: "Conférence", plural: "Conférences", short: "conférence" },
  { id: "causerie", label: "Causerie", plural: "Causeries", short: "causerie" },
  { id: "autre", label: "Autre contenu", plural: "Autres contenus", short: "contenu" },
];

function typeInfo(id) {
  return TYPES.find((t) => t.id === id) || TYPES[0];
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "";

/* ---------- helpers ---------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDateShort(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function lastFridays(n) {
  const out = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - 5 + 7) % 7;
  d.setDate(d.getDate() - diff);
  for (let i = 0; i < n; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() - 7 * (n - 1 - i));
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}

function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function StarMark({ className = "", size = 18 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 1 L20 12 L31 16 L20 20 L16 31 L12 20 L1 16 L12 12 Z" fill="currentColor" />
    </svg>
  );
}

/* ---------- app ---------- */

export default function App() {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [view, setView] = useState({ name: "grid" });
  const [toast, setToast] = useState(null);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("bndoye_admin") === "1");
  const [showLogin, setShowLogin] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    (async () => {
      if (!isConfigured) {
        setLoadError("config");
        setItems([]);
        return;
      }
      try {
        const data = await fetchAll();
        setItems(data);
      } catch (e) {
        setLoadError("network");
        setItems([]);
      }
    })();
  }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  const fridays = useMemo(() => lastFridays(8), []);
  const itemsByDate = useMemo(() => {
    const m = {};
    (items || []).filter((s) => s.type === "sermon" && s.status === "publié").forEach((s) => {
      m[s.date] = m[s.date] || [];
      m[s.date].push(s);
    });
    return m;
  }, [items]);

  const visible = useMemo(() => (items || []).filter((s) => isAdmin || s.status === "publié"), [items, isAdmin]);

  const filtered = useMemo(() => {
    return visible
      .filter((s) => !isAdmin || statusFilter === "tous" || s.status === statusFilter)
      .filter((s) => typeFilter === "tous" || s.type === typeFilter)
      .filter((s) =>
        !query.trim() ||
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        (s.theme || "").toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [visible, query, statusFilter, typeFilter, isAdmin]);

  async function upsert(item) {
    const saved = await upsertOne(item);
    setItems((prev) => {
      const exists = prev.some((s) => s.id === saved.id);
      return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev];
    });
    return saved;
  }

  async function remove(id) {
    const s = items.find((x) => x.id === id);
    await deleteOne(id);
    setItems((prev) => prev.filter((s) => s.id !== id));
    setView({ name: "grid" });
    showToast(`${typeInfo(s?.type).label} supprimé.`);
  }

  async function toggleStatus(s) {
    const next = { ...s, status: s.status === "publié" ? "brouillon" : "publié" };
    await upsert(next);
    showToast(next.status === "publié" ? "Publié." : "Remis en brouillon.");
    if (view.name === "detail") setView({ name: "detail", id: s.id });
  }

  function logout() {
    sessionStorage.removeItem("bndoye_admin");
    setIsAdmin(false);
    setView({ name: "grid" });
    showToast("Déconnecté de l'espace admin.");
  }

  if (loadError === "config") {
    return (
      <Shell>
        <ConfigWarning />
      </Shell>
    );
  }

  if (items === null) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[60vh] text-[var(--muted)]">Chargement…</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header
        fridays={fridays}
        itemsByDate={itemsByDate}
        today={lastFridays(1)[0]}
        isAdmin={isAdmin}
        onAdminClick={() => (isAdmin ? logout() : setShowLogin(true))}
      />

      {loadError === "network" && (
        <div className="mb-6 text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3.5 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} /> La connexion à la base de données a échoué. Réessayez dans un instant.
        </div>
      )}

      {view.name === "grid" && (
        <GridView
          items={filtered}
          query={query} setQuery={setQuery}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          onOpen={(id) => setView({ name: "detail", id })}
          onNew={() => setView({ name: "edit", id: null, defaultType: typeFilter !== "tous" ? typeFilter : "sermon" })}
          total={visible.length}
          isAdmin={isAdmin}
        />
      )}

      {view.name === "detail" && (
        <DetailView
          item={items.find((s) => s.id === view.id)}
          onBack={() => setView({ name: "grid" })}
          onEdit={(id) => setView({ name: "edit", id })}
          onDelete={remove}
          onToggleStatus={toggleStatus}
          isAdmin={isAdmin}
        />
      )}

      {view.name === "edit" && isAdmin && (
        <EditView
          item={items.find((s) => s.id === view.id) || null}
          defaultType={view.defaultType}
          onCancel={() => setView(view.id ? { name: "detail", id: view.id } : { name: "grid" })}
          onSave={async (s, publish) => {
            const toSave = { ...s, status: publish ? "publié" : s.status };
            const saved = await upsert(toSave);
            setView({ name: "detail", id: saved.id });
            showToast(publish ? "Publié." : "Brouillon enregistré.");
          }}
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            sessionStorage.setItem("bndoye_admin", "1");
            setIsAdmin(true);
            setShowLogin(false);
            showToast("Espace admin déverrouillé.");
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 z-50">
          <Check size={14} className="text-[var(--gold)]" />
          {toast}
        </div>
      )}
    </Shell>
  );
}

/* ---------- avertissement de configuration ---------- */

function ConfigWarning() {
  return (
    <div className="pt-16 max-w-lg mx-auto text-center">
      <AlertTriangle size={22} className="mx-auto text-[var(--gold)] mb-4" />
      <h2 className="font-display text-2xl text-[var(--text)] mb-2">Configuration manquante</h2>
      <p className="text-[var(--muted)] text-sm leading-relaxed">
        Les variables <code className="text-[var(--gold-soft)]">VITE_SUPABASE_URL</code> et{" "}
        <code className="text-[var(--gold-soft)]">VITE_SUPABASE_ANON_KEY</code> ne sont pas définies.
        Ajoutez-les dans les paramètres du projet (voir SETUP.md) puis redéployez.
      </p>
    </div>
  );
}

/* ---------- connexion admin ---------- */

function LoginModal({ onClose, onSuccess }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (ADMIN_PASSWORD && pwd === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError(true);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-5" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center gap-2 text-[var(--gold)] mb-4">
          <Lock size={16} />
          <span className="text-sm uppercase tracking-wide font-semibold">Espace admin</span>
        </div>
        <input
          type="password"
          autoFocus
          value={pwd}
          onChange={(e) => { setPwd(e.target.value); setError(false); }}
          placeholder="Mot de passe"
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--gold)] transition-colors mb-2"
        />
        {error && <p className="text-red-300 text-xs mb-2">Mot de passe incorrect.</p>}
        <div className="flex gap-2 mt-3">
          <button type="submit" className="flex-1 bg-[var(--gold)] text-[#12211D] font-semibold text-sm py-2.5 rounded-lg hover:bg-[var(--gold-soft)] transition-colors">
            Entrer
          </button>
          <button type="button" onClick={onClose} className="flex-1 border border-[var(--border)] text-[var(--muted)] text-sm py-2.5 rounded-lg hover:text-[var(--text)] transition-colors">
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- shell / fonts ---------- */

function Shell({ children }) {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        "--bg": "#12211D", "--surface": "#182E28", "--surface-2": "#20372F",
        "--gold": "#C9A227", "--gold-soft": "#E3C567", "--text": "#F2EFE6",
        "--muted": "#8FA69C", "--border": "#2A463C",
        background: "var(--bg)", color: "var(--text)",
        fontFamily: "'Inter', ui-sans-serif, system-ui",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Amiri', serif; }
        ::selection { background: var(--gold); color: #12211D; }
        input, textarea, select { outline: none; }
        input::placeholder, textarea::placeholder { color: #6d8379; }
      `}</style>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pb-24">{children}</div>
    </div>
  );
}

/* ---------- header ---------- */

function Header({ fridays, itemsByDate, today, isAdmin, onAdminClick }) {
  return (
    <header className="pt-10 pb-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[var(--gold)] text-xs tracking-[0.2em] uppercase">
          <StarMark size={12} />
          <span>Espace de l'Imam Babacar Ndoye</span>
        </div>
        <button
          onClick={onAdminClick}
          className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--gold-soft)] transition-colors flex-shrink-0"
        >
          {isAdmin ? <LogOut size={13} /> : <Lock size={13} />}
          {isAdmin ? "Quitter l'espace admin" : "Espace admin"}
        </button>
      </div>
      <h1 className="font-display text-4xl sm:text-5xl leading-tight text-[var(--text)]">
        Nos contributions à la valorisation de l'Islam
      </h1>
      <p className="text-[var(--muted)] mt-2 max-w-xl text-[15px]">
        Sermons, conférences et causeries réunis en un seul espace. Chaque perle du fil ci-dessous est un vendredi, pleine si une khutba y est publiée.
      </p>

      <div className="mt-8 flex items-center gap-0 overflow-x-auto pb-2 -mx-1 px-1">
        {fridays.map((f, i) => {
          const has = (itemsByDate[f] || []).length > 0;
          const isToday = f === today;
          return (
            <div key={f} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center gap-1.5 w-12">
                <div
                  className="rounded-full transition-all"
                  style={{
                    width: isToday ? 16 : 12, height: isToday ? 16 : 12,
                    background: has ? "var(--gold)" : "transparent",
                    border: has ? "none" : "1.5px solid var(--border)",
                  }}
                  title={fmtDate(f)}
                />
                <span className="text-[10px] text-[var(--muted)] whitespace-nowrap">{fmtDateShort(f)}</span>
              </div>
              {i < fridays.length - 1 && <div className="h-px w-4 sm:w-6 bg-[var(--border)] flex-shrink-0 -mt-4" />}
            </div>
          );
        })}
      </div>
    </header>
  );
}

/* ---------- grid view ---------- */

function GridView({ items, query, setQuery, statusFilter, setStatusFilter, typeFilter, setTypeFilter, onOpen, onNew, total, isAdmin }) {
  const newLabel = typeFilter !== "tous" ? typeInfo(typeFilter).short : "contenu";

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
        <TypeTab active={typeFilter === "tous"} onClick={() => setTypeFilter("tous")}>Tout</TypeTab>
        {TYPES.map((t) => (
          <TypeTab key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>{t.plural}</TypeTab>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un titre, un thème…"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--gold)] transition-colors"
            />
          </div>
          {isAdmin && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--gold)]"
            >
              <option value="tous">Tous statuts</option>
              <option value="publié">Publiés</option>
              <option value="brouillon">Brouillons</option>
            </select>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={onNew}
            className="flex items-center justify-center gap-1.5 bg-[var(--gold)] text-[#12211D] font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-[var(--gold-soft)] transition-colors flex-shrink-0"
          >
            <Plus size={16} /> Nouveau {newLabel}
          </button>
        )}
      </div>

      {total === 0 ? (
        <EmptyState isAdmin={isAdmin} onNew={onNew} />
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)] text-sm">Rien ne correspond à votre recherche.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((s) => <Card key={s.id} item={s} onClick={() => onOpen(s.id)} isAdmin={isAdmin} />)}
        </div>
      )}
    </div>
  );
}

function TypeTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 text-sm px-3.5 py-1.5 rounded-full border transition-colors"
      style={{
        borderColor: active ? "var(--gold)" : "var(--border)",
        color: active ? "var(--gold-soft)" : "var(--muted)",
        background: active ? "rgba(201,162,39,0.1)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ isAdmin, onNew }) {
  return (
    <div className="text-center py-24 border border-dashed border-[var(--border)] rounded-xl">
      <StarMark size={22} className="mx-auto text-[var(--gold)] mb-4" />
      <p className="font-display text-xl text-[var(--text)] mb-1">Rien pour l'instant</p>
      <p className="text-[var(--muted)] text-sm mb-6">
        {isAdmin ? "Déposez votre premier sermon, conférence ou causerie." : "Revenez bientôt pour découvrir le contenu publié."}
      </p>
      {isAdmin && (
        <button onClick={onNew} className="inline-flex items-center gap-1.5 bg-[var(--gold)] text-[#12211D] font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-[var(--gold-soft)] transition-colors">
          <Plus size={16} /> Ajouter un contenu
        </button>
      )}
    </div>
  );
}

function Thumb({ item }) {
  const yid = youtubeId(item.video_url);
  if (yid) {
    return <img src={`https://img.youtube.com/vi/${yid}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />;
  }
  const hue = Array.from(item.title || "").reduce((a, c) => a + c.charCodeAt(0), 0) % 40;
  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, hsl(${150 + hue} 30% 14%), hsl(${150 + hue} 35% 20%))` }}
    >
      <StarMark size={26} className="text-[var(--gold)] opacity-70" />
    </div>
  );
}

function Card({ item, onClick, isAdmin }) {
  return (
    <button onClick={onClick} className="text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--gold)] transition-colors group">
      <div className="aspect-video bg-[var(--surface-2)] relative">
        <Thumb item={item} />
        <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur text-[var(--gold-soft)] text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide">
          {typeInfo(item.type).short}
        </span>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={14} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
        {item.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">{item.duration} min</span>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="font-display text-[17px] leading-snug text-[var(--text)] line-clamp-2 mb-1.5">{item.title || "Sans titre"}</h3>
        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
          <span>{fmtDate(item.date)}</span>
          <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
          <span>{item.theme}</span>
        </div>
        {isAdmin && <StatusPill status={item.status} className="mt-2.5" />}
      </div>
    </button>
  );
}

function StatusPill({ status, className = "" }) {
  const published = status === "publié";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${className}`}
      style={{
        color: published ? "#12211D" : "var(--gold-soft)",
        background: published ? "var(--gold)" : "transparent",
        border: published ? "none" : "1px solid var(--border)",
      }}
    >
      {published ? <Eye size={10} /> : <EyeOff size={10} />}
      {published ? "Publié" : "Brouillon"}
    </span>
  );
}

/* ---------- detail view ---------- */

function DetailView({ item, onBack, onEdit, onDelete, onToggleStatus, isAdmin }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!item) return null;
  const yid = youtubeId(item.video_url);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors mb-5">
        <ChevronLeft size={16} /> Retour
      </button>

      <div className="aspect-video bg-[var(--surface)] rounded-xl overflow-hidden border border-[var(--border)] mb-6">
        {yid ? (
          <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yid}`} title={item.title} allowFullScreen />
        ) : (
          <div className="w-full h-full"><Thumb item={item} /></div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <h2 className="font-display text-2xl sm:text-3xl text-[var(--text)] leading-tight max-w-xl">{item.title || "Sans titre"}</h2>
        {isAdmin && <StatusPill status={item.status} />}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)] mb-6">
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ color: "var(--gold-soft)", border: "1px solid var(--border)" }}>
          {typeInfo(item.type).label}
        </span>
        <span className="flex items-center gap-1.5"><Calendar size={14} /> {fmtDate(item.date)}</span>
        {item.duration && <span className="flex items-center gap-1.5"><Clock size={14} /> {item.duration} min</span>}
        <span className="flex items-center gap-1.5"><Tag size={14} /> {item.theme}</span>
      </div>

      {item.description && <p className="text-[var(--text)] leading-relaxed max-w-2xl mb-8 whitespace-pre-wrap">{item.description}</p>}

      {isAdmin && (
        <div className="flex flex-wrap gap-2.5">
          <button onClick={() => onToggleStatus(item)} className="flex items-center gap-1.5 bg-[var(--gold)] text-[#12211D] font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-[var(--gold-soft)] transition-colors">
            <Send size={14} /> {item.status === "publié" ? "Repasser en brouillon" : "Publier"}
          </button>
          <button onClick={() => onEdit(item.id)} className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-sm px-4 py-2.5 rounded-lg hover:border-[var(--gold)] transition-colors">
            <Pencil size={14} /> Modifier
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 bg-transparent border border-[var(--border)] text-[var(--muted)] text-sm px-4 py-2.5 rounded-lg hover:border-red-400/50 hover:text-red-300 transition-colors">
              <Trash2 size={14} /> Supprimer
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">Confirmer la suppression ?</span>
              <button onClick={() => onDelete(item.id)} className="text-red-300 font-semibold hover:underline">Oui, supprimer</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[var(--muted)] hover:underline">Annuler</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- edit view ---------- */

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs uppercase tracking-wide text-[var(--muted)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--gold)] transition-colors";

function EditView({ item, defaultType, onCancel, onSave }) {
  const isNew = !item;
  const [form, setForm] = useState(
    item || {
      id: uid(), type: defaultType || "sermon", title: "", date: lastFridays(1)[0],
      theme: THEMES[0], description: "", video_url: "", status: "brouillon", duration: "",
    }
  );
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSave = form.title.trim().length > 0 && !saving;
  const kind = typeInfo(form.type);

  async function handleSave(publish) {
    setSaving(true);
    try {
      await onSave(form, publish);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button onClick={onCancel} className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors mb-5">
        <ChevronLeft size={16} /> {isNew ? "Annuler" : "Retour"}
      </button>

      <h2 className="font-display text-2xl sm:text-3xl text-[var(--text)] mb-6">
        {isNew ? "Nouveau contenu" : `Modifier : ${kind.label.toLowerCase()}`}
      </h2>

      <div className="max-w-xl">
        <Field label="Type de contenu">
          <div className="flex gap-2 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t.id} type="button"
                onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                className="text-sm px-3.5 py-1.5 rounded-full border transition-colors"
                style={{
                  borderColor: form.type === t.id ? "var(--gold)" : "var(--border)",
                  color: form.type === t.id ? "var(--gold-soft)" : "var(--muted)",
                  background: form.type === t.id ? "rgba(201,162,39,0.1)" : "transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Titre">
          <input className={inputClass} value={form.title} onChange={set("title")} placeholder="Ex. La patience face à l'épreuve" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={form.type === "sermon" ? "Date (vendredi)" : "Date"}>
            <input type="date" className={inputClass} value={form.date} onChange={set("date")} />
          </Field>
          <Field label="Durée (min)">
            <input className={inputClass} value={form.duration} onChange={set("duration")} placeholder="20" inputMode="numeric" />
          </Field>
        </div>

        <Field label="Thème">
          <select className={inputClass} value={form.theme} onChange={set("theme")}>
            {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="Lien vidéo (YouTube)">
          <div className="relative">
            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input className={inputClass + " pl-9"} value={form.video_url} onChange={set("video_url")} placeholder="https://youtube.com/watch?v=…" />
          </div>
        </Field>

        <Field label="Description">
          <textarea rows={5} className={inputClass + " resize-none"} value={form.description} onChange={set("description")} placeholder={`Résumé de la ${kind.short}, points clés…`} />
        </Field>

        <div className="flex flex-wrap gap-2.5 mt-6">
          <button disabled={!canSave} onClick={() => handleSave(true)} className="flex items-center gap-1.5 bg-[var(--gold)] text-[#12211D] font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-[var(--gold-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Send size={14} /> {saving ? "Enregistrement…" : "Publier"}
          </button>
          <button disabled={!canSave} onClick={() => handleSave(false)} className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-sm px-4 py-2.5 rounded-lg hover:border-[var(--gold)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <FileText size={14} /> Enregistrer en brouillon
          </button>
        </div>
      </div>
    </div>
  );
}

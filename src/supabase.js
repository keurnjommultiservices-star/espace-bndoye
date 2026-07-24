// Connexion à Supabase (base de données réelle, en ligne).
//
// Où trouver ces deux valeurs :
// 1. Créez un compte sur https://supabase.com et un nouveau projet
// 2. Dans le projet -> Project Settings -> API
// 3. Copiez "Project URL" et la clé "anon public"
//
// Sur Vercel, définissez-les comme variables d'environnement :
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
// (voir SETUP.md pour le détail des étapes)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Récupère toutes les publications, triées des plus récentes aux plus anciennes.
export async function fetchAll() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/publications?select=*&order=date.desc`,
    { headers }
  );
  if (!res.ok) throw new Error("Impossible de charger les publications.");
  return res.json();
}

// Crée ou met à jour une publication (upsert basé sur l'id).
export async function upsertOne(record) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/publications`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error("Impossible d'enregistrer la publication.");
  const data = await res.json();
  return data[0];
}

// Supprime une publication par id.
export async function deleteOne(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/publications?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Impossible de supprimer la publication.");
}

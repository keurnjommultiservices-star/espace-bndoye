# Mettre en ligne l'espace de l'Imam Babacar Ndoye

Ce guide vous fait passer du code à un vrai site en ligne, en trois grandes étapes :
**1) la base de données (Supabase)** → **2) le code sur GitHub** → **3) le déploiement (Vercel)**.

Aucune de ces étapes ne demande de savoir coder. Comptez 20-30 minutes.

---

## 1. Créer la base de données (Supabase — gratuit)

1. Allez sur https://supabase.com et créez un compte (gratuit).
2. Cliquez **New project**. Donnez-lui un nom (ex. `espace-bndoye`) et un mot de passe de base de données (notez-le quelque part, vous n'en aurez plus besoin après).
3. Une fois le projet créé, allez dans **SQL Editor** (menu de gauche) → **New query**, collez ce qui suit, puis cliquez **Run** :

```sql
create table publications (
  id text primary key,
  type text not null default 'sermon',
  title text not null,
  date date not null,
  theme text,
  description text,
  video_url text,
  status text not null default 'brouillon',
  duration text,
  created_at timestamp with time zone default now()
);

alter table publications enable row level security;

create policy "Lecture publique" on publications
  for select using (true);

create policy "Ecriture publique" on publications
  for insert with check (true);

create policy "Modification publique" on publications
  for update using (true);

create policy "Suppression publique" on publications
  for delete using (true);
```

> Note de sécurité : ces règles autorisent toute personne connaissant votre clé "anon" (publique par nature) à lire ET modifier les données. C'est volontairement simple pour démarrer. Le vrai verrou d'écriture, ici, est le mot de passe de l'espace admin (étape 3 ci-dessous), pas la base elle-même. Si un jour vous voulez un niveau de sécurité supérieur (comptes utilisateurs réels), on pourra migrer vers Supabase Auth.

4. Allez dans **Project Settings** (roue crantée) → **API**. Notez deux valeurs :
   - **Project URL**
   - **anon public** (la clé)

Gardez cet onglet ouvert, vous en aurez besoin à l'étape 3.

---

## 2. Mettre le code sur GitHub

1. Créez un compte sur https://github.com si vous n'en avez pas.
2. Créez un nouveau dépôt (bouton **New**), nommez-le `espace-bndoye`, laissez-le public ou privé (les deux fonctionnent avec Vercel).
3. Téléversez tous les fichiers de ce projet dans le dépôt (glisser-déposer via l'interface GitHub, ou "uploading an existing file").

---

## 3. Déployer sur Vercel (gratuit)

1. Allez sur https://vercel.com, créez un compte avec votre compte GitHub.
2. Cliquez **Add New** → **Project**, choisissez le dépôt `espace-bndoye`.
3. Avant de cliquer sur Deploy, ouvrez **Environment Variables** et ajoutez :

| Nom | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | (collé depuis Supabase, étape 1) |
| `VITE_SUPABASE_ANON_KEY` | (collé depuis Supabase, étape 1) |
| `VITE_ADMIN_PASSWORD` | Le mot de passe que vous et l'imam utiliserez pour gérer le contenu |

4. Cliquez **Deploy**. Après 1-2 minutes, votre site est en ligne sur une adresse du type `espace-bndoye.vercel.app`.

---

## 4. (Optionnel) Ajouter votre propre nom de domaine

Dans le projet Vercel → **Settings** → **Domains**, ajoutez votre domaine (ex. `espace-bndoye.com`, acheté chez un registrar comme Namecheap ou OVH, ~10-15€/an). Vercel vous donne les enregistrements DNS à ajouter chez votre registrar — ça prend quelques minutes à se propager.

---

## Utilisation au quotidien

- **Le public** visite le site normalement et ne voit que le contenu que vous avez publié.
- **Vous / l'imam** cliquez sur "Espace admin" en haut à droite, entrez le mot de passe défini plus haut, et vous pouvez ajouter, modifier, publier ou supprimer du contenu.
- Toute modification est immédiatement visible par tous les visiteurs (base de données en temps réel).

## Si quelque chose ne fonctionne pas

- Site affichant "Configuration manquante" → vérifiez que les 3 variables d'environnement sont bien renseignées dans Vercel, puis redéployez.
- Mot de passe admin refusé → vérifiez qu'il correspond exactement à `VITE_ADMIN_PASSWORD` dans Vercel (attention aux espaces).

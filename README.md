# Environnement intégré de la suite

Rocket Auth (fournisseur d'identité), Rocket Print, Rocket Cloud et Rocket Mailer démarrés ensemble, **en mode suite** (voir « Modes autonome et suite » dans le [README](../README.md)) : on se connecte à une application par Rocket Auth, on passe à une autre par le sélecteur d'applications sans se reconnecter, et la déconnexion met fin à la session Rocket Auth.

Les images sont construites à partir des dépôts des briques, avec leurs propres Dockerfiles : l'environnement teste les briques telles qu'elles sont. Le workflow GitHub Actions `Suite` (`.github/workflows/suite.yml`) le démarre et y joue le scénario complet dans un navigateur ([`e2e/suite.spec.js`](e2e/suite.spec.js)).

## Lancer en local

Pré-requis : Docker avec Compose v2.24 ou plus récent, et les dépôts clonés côte à côte, sur la même branche :

```bash
git clone https://github.com/fayouz/rocket-core.git
git clone https://github.com/fayouz/rocket-auth.git
git clone https://github.com/fayouz/rocket-print.git
git clone https://github.com/fayouz/rocket-cloud.git
git clone https://github.com/fayouz/rocket-mailer.git

cd rocket-core
docker compose -f suite/compose.yaml up --build
```

Le premier lancement prend plusieurs minutes (construction de huit images). Les services `auth-seed`, `print-seed`, `cloud-seed` et `mailer-seed` créent chacun leur base, chargent les données de démo puis s'arrêtent ; les API démarrent ensuite.

Des dépôts ailleurs ? Indique leur chemin (relatif au dossier `suite/`, ou absolu) :

```bash
ROCKET_AUTH_DIR=~/src/rocket-auth ROCKET_PRINT_DIR=~/src/rocket-print ROCKET_CLOUD_DIR=~/src/rocket-cloud ROCKET_MAILER_DIR=~/src/rocket-mailer \
  docker compose -f suite/compose.yaml up --build
```

## Adresses

| Adresse | Application |
|---|---|
| http://localhost:3100 | Rocket Auth : comptes, groupes, annuaire, clients OAuth (« Mon compte ») |
| http://localhost:3300 | Rocket Print |
| http://localhost:3200 | Rocket Cloud |
| http://localhost:3000 | Rocket Mailer |
| http://localhost:8025 | Mailpit : les emails envoyés par Rocket Mailer (relais SMTP de la suite) |
| http://localhost:3100/.well-known/openid-configuration | Découverte OpenID Connect |

Le navigateur ne parle qu'aux interfaces : elles relaient `/api` vers leur API, et celle de Rocket Auth relaie aussi `/oauth` et `/.well-known`. L'émetteur de Rocket Auth est donc `http://localhost:3100` ; les API des briques le joignent dans le réseau Docker (`ROCKET_AUTH_INTERNAL_URL=http://auth-api`). Chaque application a son propre cookie (`rocket_<id>_token`) : partager `localhost` entre les ports ne pose pas de problème. Dans l'autre sens, Rocket Auth envoie les déconnexions (back-channel logout) aux API des briques (`ROCKET_INTERNAL_URL=http://print-api`, `http://cloud-api`, `http://mailer-api`).

## Comptes

Les utilisateurs et les groupes sont gérés dans Rocket Auth ; les briques créent le compte à la première connexion.

| Compte | Mot de passe | |
|---|---|---|
| `marie.martin@example.org` | `password` | annuaire LDAP, administratrice partout par le groupe `rocket-admins` |
| `jean.dupont@example.org` | `password` | annuaire LDAP, utilisateur |
| `admin@example.org` | `demo-admin-password` | local à Rocket Auth, groupe `rocket-admins` |
| `alice@example.org` | `demo-alice-password` | local à Rocket Auth, utilisatrice |

Clients OAuth déclarés dans Rocket Auth (`DEMO_OAUTH_CLIENTS`) : `rocket-print` / `demo-rocket-print-client-secret`, `rocket-cloud` / `demo-rocket-cloud-client-secret`, `rocket-mailer` / `demo-rocket-mailer-client-secret`.

## Scénario

1. Ouvre http://localhost:3300 : Rocket Print renvoie vers la page de connexion de Rocket Auth.
2. Connecte-toi avec `marie.martin@example.org` / `password` : retour dans Rocket Print, en administratrice (menu *Administration*).
3. Le sélecteur en haut du menu liste Rocket Cloud, Rocket Mailer et Rocket Print, et « Mon compte (Rocket Auth) ».
4. Choisis Rocket Mailer : il s'ouvre sans redemander le mot de passe, en administratrice. Les emails envoyés arrivent dans Mailpit (http://localhost:8025).
5. Depuis son sélecteur, choisis Rocket Cloud : même chose.
6. Déconnecte-toi de Rocket Cloud, puis clique sur « Se connecter avec Rocket Auth » : Rocket Auth redemande le mot de passe.

Le même scénario, automatisé :

```bash
cd suite/e2e
npm ci && npx playwright install chromium
npx playwright test          # captures dans screenshots/, traces dans test-results/
```

## Ajouter une brique

Comme Rocket Mailer (port 3000) : une entrée dans `DEMO_OAUTH_CLIENTS` (service Rocket Auth), puis les services `<brique>-seed`, `<brique>-api`, `<brique>-worker` et `<brique>-front` copiés de ceux de Rocket Print (avec `ROCKET_<BRIQUE>_DIR`, sa base, son secret et son `ROCKET_INTERNAL_URL`), plus ses besoins propres (pour Rocket Mailer : le relais SMTP Mailpit, `MAILER_DSN`, `MAILBOX_ENCRYPTION_KEY` et le volume des pièces jointes partagé par l'API et le worker). La base est créée par son `seed`, rien à changer côté PostgreSQL. Dans le workflow, ajouter le dépôt à la liste des branches, un `actions/checkout`, son `seed` et son adresse dans les attentes.

## Réinitialiser

```bash
docker compose -f suite/compose.yaml down -v
```

> Mots de passe, secrets de clients et jetons d'application publics : ne jamais exposer cet environnement sur Internet.

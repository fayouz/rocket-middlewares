# rocket-suite

Environnement intégré de la suite Rocket, et chaque brique seule.

Rocket Auth (fournisseur d'identité), Rocket Print, Rocket Cloud, Rocket Mailer et Rocket PMS démarrés ensemble, **en mode suite** (voir « Modes autonome et suite » dans le [README de rocket-core](https://github.com/fayouz/rocket-core#modes-autonome-et-suite)) : on se connecte à une application par Rocket Auth, on passe à une autre par le sélecteur d'applications sans se reconnecter, et la déconnexion met fin à la session Rocket Auth.

Les images sont construites à partir des dépôts des briques, avec leurs propres Dockerfiles : l'environnement teste les briques telles qu'elles sont. Le workflow GitHub Actions `Suite` ([`.github/workflows/suite.yml`](.github/workflows/suite.yml)) le démarre et y joue le scénario complet dans un navigateur ([`e2e/suite.spec.js`](e2e/suite.spec.js)).

## Lancer en local

Pré-requis : Docker avec Compose v2.24 ou plus récent, et les dépôts clonés côte à côte, sur la même branche :

```bash
git clone https://github.com/fayouz/rocket-suite.git
git clone https://github.com/fayouz/rocket-auth.git
git clone https://github.com/fayouz/rocket-print.git
git clone https://github.com/fayouz/rocket-cloud.git
git clone https://github.com/fayouz/rocket-mailer.git
git clone https://github.com/fayouz/rocket-pms.git

cd rocket-suite
docker compose up --build
```

Le premier lancement prend plusieurs minutes (construction de dix images). Les services `auth-seed`, `print-seed`, `cloud-seed`, `mailer-seed` et `pms-seed` créent chacun leur base, chargent les données de démo puis s'arrêtent ; les API démarrent ensuite.

Des dépôts ailleurs ? Indique leur chemin (relatif au dossier `rocket-suite/`, ou absolu) :

```bash
ROCKET_AUTH_DIR=~/src/rocket-auth ROCKET_PRINT_DIR=~/src/rocket-print ROCKET_CLOUD_DIR=~/src/rocket-cloud ROCKET_MAILER_DIR=~/src/rocket-mailer ROCKET_PMS_DIR=~/src/rocket-pms \
  docker compose up --build
```

### Une brique seule

`compose.auth.yaml`, `compose.print.yaml`, `compose.cloud.yaml`, `compose.mailer.yaml` et `compose.pms.yaml` démarrent une brique en mode autonome (sa propre connexion) avec ses données de démo : ils incluent le `compose.yaml` et le `compose.demo.yaml` de la brique, sans rien recopier.

```bash
docker compose -f compose.print.yaml up -d --build
```

Mêmes ports que la suite : arrête l'une avant de démarrer l'autre (`docker compose down` garde les données). Adresses et comptes : `demo/README.md` de chaque brique.

### Avec Podman

Podman construit les images en parallèle et ne connaît pas `COPY --link` (Dockerfiles des briques) : construire une image à la fois, avec une machine Podman d'au moins 4 Go de mémoire, et retirer `--link` des Dockerfiles tant qu'il y est.

```bash
COMPOSE_PARALLEL_LIMIT=1 docker compose build && docker compose up -d
```

## Dans un Codespace

Rien à installer ni à stocker en local : **Code › Codespaces › Create codespace on main** sur GitHub. La configuration (`.devcontainer/`) clone les cinq briques à côté du dépôt, sur la même branche quand elle existe (sinon `main`), puis construit et démarre la suite (quelques minutes la première fois). Pour une brique seule : `bash .devcontainer/start.sh print` (ou `auth`, `cloud`, `mailer`, `pms`) ; `bash .devcontainer/start.sh` revient à la suite.

Ouvre le Codespace dans **VS Code** (bureau), ou transfère les ports avec `gh codespace ports forward 3100:3100 3300:3300 3200:3200 3000:3000 3700:3700 8025:8025` : l'émetteur de Rocket Auth et les redirections OAuth sont en `http://localhost:<port>`, donc la connexion ne fonctionne pas par les adresses `*.app.github.dev` de VS Code dans le navigateur.

## Adresses

| Adresse | Application |
|---|---|
| http://localhost:3100 | Rocket Auth : comptes, groupes, annuaire, clients OAuth (« Mon compte ») |
| http://localhost:3300 | Rocket Print |
| http://localhost:3200 | Rocket Cloud |
| http://localhost:3000 | Rocket Mailer |
| http://localhost:3700 | Rocket PMS |
| http://localhost:8025 | Mailpit : les emails envoyés par Rocket Mailer (relais SMTP de la suite) |
| http://localhost:3100/.well-known/openid-configuration | Découverte OpenID Connect |

Le navigateur ne parle qu'aux interfaces : elles relaient `/api` vers leur API, et celle de Rocket Auth relaie aussi `/oauth` et `/.well-known`. L'émetteur de Rocket Auth est donc `http://localhost:3100` ; les API des briques le joignent dans le réseau Docker (`ROCKET_AUTH_INTERNAL_URL=http://auth-api`). Chaque application a son propre cookie (`rocket_<id>_token`) : partager `localhost` entre les ports ne pose pas de problème. Dans l'autre sens, Rocket Auth envoie les déconnexions (back-channel logout) aux API des briques (`ROCKET_INTERNAL_URL=http://print-api`, `http://cloud-api`, `http://mailer-api`, `http://pms-api`). Rocket Cloud envoie ses notifications de partage par Rocket Mailer (`ROCKET_MAILER_URL=http://mailer-api`) avec un jeton de Rocket Auth (client credentials) : les données de démo de Rocket Mailer lient son application « Rocket Cloud » au client `rocket-cloud`. Rocket PMS stocke les documents de chaque logement dans Rocket Cloud (`ROCKET_CLOUD_URL=http://cloud-api`) : cet environnement de démo lui donne directement le jeton d'application de démonstration de Rocket Cloud (`rca_…`) ; un déploiement réel devrait plutôt lier Rocket PMS à une application Rocket Cloud (jeton client credentials de Rocket Auth, voir le README de rocket-core).

## Comptes

Les utilisateurs et les groupes sont gérés dans Rocket Auth ; les briques créent le compte à la première connexion.

| Compte | Mot de passe | |
|---|---|---|
| `marie.martin@example.org` | `password` | annuaire LDAP, administratrice partout par le groupe `rocket-admins` |
| `jean.dupont@example.org` | `password` | annuaire LDAP, utilisateur |
| `admin@example.org` | `demo-admin-password` | local à Rocket Auth, groupe `rocket-admins` |
| `alice@example.org` | `demo-alice-password` | local à Rocket Auth, utilisatrice |

Clients OAuth déclarés dans Rocket Auth (`DEMO_OAUTH_CLIENTS`) : `rocket-print` / `demo-rocket-print-client-secret`, `rocket-cloud` / `demo-rocket-cloud-client-secret`, `rocket-mailer` / `demo-rocket-mailer-client-secret`, `rocket-pms` / `demo-rocket-pms-client-secret`.

## Scénario

1. Ouvre http://localhost:3300 : Rocket Print renvoie vers la page de connexion de Rocket Auth.
2. Connecte-toi avec `marie.martin@example.org` / `password` : retour dans Rocket Print, en administratrice (menu *Administration*).
3. Le sélecteur en haut du menu liste Rocket Cloud, Rocket Mailer et Rocket Print, et « Mon compte (Rocket Auth) ».
4. Choisis Rocket Mailer : il s'ouvre sans redemander le mot de passe, en administratrice. Les emails envoyés arrivent dans Mailpit (http://localhost:8025).
5. Depuis son sélecteur, choisis Rocket Cloud : même chose.
6. Déconnecte-toi de Rocket Cloud, puis clique sur « Se connecter avec Rocket Auth » : Rocket Auth redemande le mot de passe.

Le même scénario, automatisé :

```bash
cd e2e
npm ci && npx playwright install chromium
npx playwright test          # captures dans screenshots/, traces dans test-results/
```

## Ajouter une brique

Comme Rocket Mailer (port 3000) : une entrée dans `DEMO_OAUTH_CLIENTS` (service Rocket Auth), puis les services `<brique>-seed`, `<brique>-api`, `<brique>-worker` et `<brique>-front` copiés de ceux de Rocket Print (avec `ROCKET_<BRIQUE>_DIR`, sa base, son secret et son `ROCKET_INTERNAL_URL`), plus ses besoins propres (pour Rocket Mailer : le relais SMTP Mailpit, `MAILER_DSN`, `MAILBOX_ENCRYPTION_KEY` et le volume des pièces jointes partagé par l'API et le worker). La base est créée par son `seed`, rien à changer côté PostgreSQL. Ajouter aussi son `compose.<brique>.yaml` (copié de `compose.print.yaml`), et la brique à `.devcontainer/clone-bricks.sh` et `.devcontainer/start.sh`. Dans le workflow, ajouter le dépôt à la liste des branches, un `actions/checkout`, son `seed` et son adresse dans les attentes.

## Réinitialiser

```bash
docker compose down -v
```

> Mots de passe, secrets de clients et jetons d'application publics : ne jamais exposer cet environnement sur Internet.

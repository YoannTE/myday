Provisionne un tenant sur agent-platform-core et retourne les credentials. Utilisable depuis n'importe quel projet, ne dépend pas de `.project/`.

# /provision-tenant

Usage : `/provision-tenant <slug> "<nom complet du tenant>" <admin_email>`

Exemple : `/provision-tenant acme-corp "ACME Corporation" admin@acme.com`

---

## Précondition

Cette commande est **indépendante de `.project/`** - testable depuis n'importe quel dossier (`cd ~ && /provision-tenant acme-corp "ACME"` doit fonctionner).

Variables d'environnement requises (lues depuis le shell) :

- `AGENT_PLATFORM_CORE_URL` - ex: `https://agents.reborn.dev/api` (le `/api` final est obligatoire en prod : Traefik route `/api/v1/*` vers le backend FastAPI). En dev local : `http://localhost:8000`.
- `AGENT_PLATFORM_MASTER_KEY` - clé admin avec droits de provisionnement, gardée dans gestionnaire de secrets

---

## Étape 1 - Lire les variables d'environnement

```bash
# Si AGENT_PLATFORM_CORE_URL absent, demander interactivement
if [ -z "$AGENT_PLATFORM_CORE_URL" ]; then
    read -rp "URL Reborn Agents Core (ex: https://agents.reborn.dev): " AGENT_PLATFORM_CORE_URL
fi

# Si master_key absente, demander avec masquage (read -s) pour éviter l'historique shell
if [ -z "$AGENT_PLATFORM_MASTER_KEY" ]; then
    read -rs -p "Master key admin Reborn Agents Core: " AGENT_PLATFORM_MASTER_KEY
    echo
fi
```

**JAMAIS** persister la `master_key` dans aucun fichier du projet courant. C'est une clé admin globale, propre à l'utilisateur.

---

## Étape 2 - Parser et valider les arguments

```bash
SLUG="$1"
NAME="$2"
ADMIN_EMAIL="$3"

if [ -z "$SLUG" ] || [ -z "$NAME" ] || [ -z "$ADMIN_EMAIL" ]; then
    echo "Usage : /provision-tenant <slug> \"<nom complet>\" <admin_email>"
    echo "Exemple : /provision-tenant acme-corp \"ACME Corporation\" admin@acme.com"
    exit 1
fi

if ! echo "$SLUG" | grep -qE '^[a-z0-9-]{3,50}$'; then
    echo "❌ Slug invalide : \"$SLUG\""
    echo "Format attendu : kebab-case, 3-50 caractères (lettres minuscules, chiffres, tirets)."
    exit 1
fi

if [ "${#NAME}" -lt 3 ] || [ "${#NAME}" -gt 100 ]; then
    echo "❌ Nom invalide : doit contenir entre 3 et 100 caractères."
    exit 1
fi

if ! echo "$ADMIN_EMAIL" | grep -qE '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'; then
    echo "❌ Email admin invalide : \"$ADMIN_EMAIL\""
    exit 1
fi
```

---

## Étape 3 - Appel Core

```bash
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$AGENT_PLATFORM_CORE_URL/v1/admin/tenants" \
    -H "Authorization: Bearer $AGENT_PLATFORM_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"slug\": \"$SLUG\", \"name\": \"$NAME\", \"admin_email\": \"$ADMIN_EMAIL\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
```

---

## Étape 4 - Gérer les erreurs

```bash
if [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Endpoint /v1/admin/tenants introuvable sur $AGENT_PLATFORM_CORE_URL."
    echo "Vérifie que le Core R5 admin est déployé avec cet endpoint."
    echo "Body complet de la réponse :"
    echo "$BODY"
    exit 1
elif [ "$HTTP_CODE" = "401" ]; then
    echo "❌ Master key invalide (401). Vérifie AGENT_PLATFORM_MASTER_KEY."
    exit 1
elif [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo "❌ Erreur Core (HTTP $HTTP_CODE) :"
    echo "$BODY"
    exit 1
fi
```

---

## Étape 5 - Parser la réponse et afficher avec masquage

```bash
TENANT_ID=$(echo "$BODY" | jq -r '.tenant_id')
API_KEY=$(echo "$BODY" | jq -r '.api_key // empty')
DATABASE_URL=$(echo "$BODY" | jq -r '.database_url // empty')
INVITATION_LINK=$(echo "$BODY" | jq -r '.invitation_link')

if [ "$HTTP_CODE" = "200" ]; then
    echo "ℹ️  Replay : le tenant $SLUG existait déjà - credentials non régénérés."
    echo
    echo "-------------------------------------------------------------------"
    echo "  Lien d'invitation - envoie ce lien à $ADMIN_EMAIL :"
    echo "  $INVITATION_LINK"
    echo "-------------------------------------------------------------------"
    echo
    echo "AGENT_PLATFORM_APP_NAME est pré-rempli avec ton slug \`$SLUG\` - tu peux"
    echo "le remplacer par n'importe quel nom dans .env.local (visible dans le"
    echo "dashboard observabilité)."
    echo
    echo "# api_key et database_url non régénérées sur replay - récupère-les dans le panel admin"
    echo "AGENT_PLATFORM_URL=$AGENT_PLATFORM_CORE_URL"
    echo "AGENT_PLATFORM_API_KEY=A_RECUPERER_DANS_PANEL_ADMIN"
    if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "null" ]; then
        echo "AGENT_PLATFORM_DATABASE_URL=$DATABASE_URL"
    else
        echo "AGENT_PLATFORM_DATABASE_URL=A_RECUPERER_DANS_PANEL_ADMIN"
        echo "# Core agent-platform >= 0.2.0 expose ce champ."
        echo "# Si tu vois ce message, mets à jour le Core ou récupère la DSN dans le panel admin."
    fi
    echo "AGENT_PLATFORM_TENANT_ID=$TENANT_ID"
    echo "AGENT_PLATFORM_APP_NAME=$SLUG"
else
    echo "✅ Tenant provisionné !"
    echo
    echo "-------------------------------------------------------------------"
    echo "  Lien d'invitation - envoie ce lien à $ADMIN_EMAIL :"
    echo "  $INVITATION_LINK"
    echo "  Il devient admin du tenant en cliquant dessus."
    echo "-------------------------------------------------------------------"
    echo
    echo "  ⚠️  Les valeurs ci-dessous ne sont visibles qu'une seule fois."
    echo "  Copie-les dans backend/.env.local maintenant."
    echo
    echo "AGENT_PLATFORM_APP_NAME est pré-rempli avec ton slug \`$SLUG\` - tu peux"
    echo "le remplacer par n'importe quel nom dans .env.local (visible dans le"
    echo "dashboard observabilité)."
    echo
    echo "AGENT_PLATFORM_URL=$AGENT_PLATFORM_CORE_URL"
    if [ -n "$API_KEY" ] && [ "$API_KEY" != "null" ]; then
        echo "AGENT_PLATFORM_API_KEY=$API_KEY"
    else
        echo "AGENT_PLATFORM_API_KEY=A_RECUPERER_DANS_PANEL_ADMIN"
    fi
    if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "null" ]; then
        echo "AGENT_PLATFORM_DATABASE_URL=$DATABASE_URL"
    else
        echo "AGENT_PLATFORM_DATABASE_URL=A_RECUPERER_DANS_PANEL_ADMIN"
        echo "# Core agent-platform >= 0.2.0 expose ce champ."
        echo "# Si tu vois ce message, mets à jour le Core ou récupère la DSN dans le panel admin."
    fi
    echo "AGENT_PLATFORM_TENANT_ID=$TENANT_ID"
    echo "AGENT_PLATFORM_APP_NAME=$SLUG"
fi

echo
echo "Prochaine étape : colle ces lignes dans backend/.env.local,"
echo "puis lance /add-agents-platform."
```

---

## Notes de sécurité

- La `master_key` est demandée via `read -s` - saisie sans écho, hors historique shell
- L'`api_key` du tenant est affichée **une seule fois** - pas de persistance dans `.project/` ni dans le shell
- Sur replay (HTTP 200), `api_key` est `null` - la première création reste la seule fenêtre pour la récupérer

# SOP — Vérifier l'enregistrement des routes FastAPI (piège `app.routes` sous fastapi 0.139+)

**ID** : backend-fastapi-route-registration-check
**Catégorie** : Backend
**Difficulté** : intermediate
**Tags** : fastapi, include_router, routing, introspection, version-gotcha, boot-check
**Créé le** : 2026-07-11
**Origine** : Round 004 (Cockpit) — fausse alerte « aucun router enregistré »

## Symptôme

En vérifiant qu'un `include_router` a bien pris effet, on inspecte `app.routes` en
cherchant des objets `fastapi.routing.APIRoute` … et on en trouve **zéro**, alors que
les endpoints répondent parfaitement (tests verts, `curl` OK). Panique inutile : on
croit que `main.py` n'enregistre rien, on soupçonne un `try/except ImportError` qui
masque une erreur, on downgrade des dépendances au hasard.

## Cause racine (comportement volontaire, pas un bug)

Depuis **fastapi 0.139** (version « futuriste » de ce starterkit — cf. `AGENTS.md`
« This is NOT the Next.js you know », qui vaut aussi pour les autres deps non pinées),
`app.include_router(r, prefix="/api")` **n'aplatit plus** les `APIRoute` du sous-routeur
dans `app.routes`. Il ajoute UN SEUL objet `fastapi.routing._IncludedRouter` qui contient
les routes de façon imbriquée. Donc :

```python
before = len(app.routes)          # 4 (openapi, docs, redoc, oauth2-redirect)
app.include_router(tasks_router, prefix="/api")
len(app.routes)                   # 5  <- +1 (_IncludedRouter), PAS +4 routes
[r for r in app.routes if isinstance(r, APIRoute)]   # []  <- TROMPEUR
```

Les routes existent bel et bien, elles ne sont juste plus visibles à plat.

## La bonne façon de vérifier (fiable, version-agnostique)

**Ne jamais** conclure « routers non enregistrés » depuis un filtre `isinstance(r, APIRoute)`
sur `app.routes`. Utiliser l'une de ces méthodes qui testent le comportement réel :

1. **TestClient (source de vérité runtime)** — la meilleure :
   ```python
   from fastapi.testclient import TestClient
   import app.main as m
   c = TestClient(m.app)
   assert c.get("/health").status_code == 200
   assert c.get("/api/tasks").status_code == 401   # protégé = enregistré
   ```
2. **Import direct qui lève** : `python -c "import app.main"` — si un router a une vraie
   erreur d'import, ça casse ici avec un traceback (sauf s'il est avalé par un
   `try/except ImportError`, cf. ci-dessous).
3. `curl` sur le serveur live après redémarrage (401 sans cookie = route protégée montée).

## Pièges connexes vus dans ce round

- **`try/except ImportError` autour d'un `include_router`** (utilisé pendant la convergence
  de 2 agents backend en parallèle) : garde-fou utile au boot, mais retirer/vérifier après
  convergence — sinon un vrai `ImportError` reste silencieux. Toujours finir par un
  boot-check TestClient qui prouve que les routers optionnels sont bien montés.
- **Serveur uvicorn sans `--reload`** : un process lancé AVANT l'ajout de nouveaux fichiers
  garde en mémoire l'ancienne app (répond encore aux anciens endpoints, 404 sur les
  nouveaux). Après un round qui ajoute des endpoints, **redémarrer uvicorn** puis re-vérifier
  les endpoints live.
- **Deps non pinées** : `requirements.txt` sans versions peut tirer une version majeure qui
  change un comportement (ici starlette 1.x). Avant de pin, confirmer que c'est vraiment la
  cause (le TestClient l'aurait montré : ici il ne l'était PAS). Ne pas downgrader au hasard.

## Règle

Pour prouver qu'un endpoint est monté : **frapper l'endpoint** (TestClient / curl), jamais
compter des `APIRoute` dans `app.routes`.

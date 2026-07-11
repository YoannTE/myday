Prépare la mise en ligne du projet Reborn et accompagne l'utilisateur jusqu'au bouton de déploiement de l'app.

Important : le déploiement effectif est orchestré par l'application Reborn (push GitHub, webhook Dokploy, polling build). Ne lance pas de déploiement externe non demandé depuis le terminal.

1. Lis `.project/app.md`, `.project/roadmap.md`, `.project/polish.md` si présents.
2. Vérifie que l'application est prête à être publiée :
   - build local possible ou scripts identifiés (`npm run build`, `pnpm build`, etc.) ;
   - variables d'environnement documentées ;
   - migrations ou seed nécessaires listés ;
   - Dockerfile / `.dockerignore` / config de production présents si le projet en a besoin ;
   - README ou notes de run à jour.
3. Si un point manque, corrige-le directement ou crée une checklist claire dans `.project/deploy.md`.
4. N'utilise les commandes git que pour vérifier l'état (`git status`, `git diff`) sauf demande explicite de l'utilisateur.
5. Termine avec un résumé court :
   - prêt / pas prêt ;
   - points corrigés ;
   - points à traiter avant clic « Publier » ;
   - commande ou bouton recommandé côté Reborn.

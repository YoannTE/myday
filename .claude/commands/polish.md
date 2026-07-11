Finalise l'application avant la mise en production. Checklist complete de peaufinage.

**REGLE UI** : avant chaque Write/Edit long de `.project/polish.md` ou
de pages legales (mentions, CGU, etc.), appelle d'abord
`notify_writing({ file_path: "<chemin>" })` pour afficher l'animation
plume cote UI pendant la redaction. Cf. CLAUDE.md section
« Hook `notify_writing` ». Ignorer si tu n'as pas ce tool.

1. Lis .project/app.md et BRIEF.md pour le contexte du projet
2. Cree .project/polish.md avec la checklist suivante (si le fichier n'existe pas)

3. Passe chaque point de la checklist et traite-le :

=== LEGAL & RGPD ===
□ Page mentions legales (obligatoire en France)
□ Page politique de confidentialite
□ CGU (conditions generales d'utilisation)
□ Bandeau cookie RGPD (consentement)

=== SEO ===
□ Favicon (dans public/ + manifest)
□ Meta title + description sur chaque page
□ Open Graph images (og:image pour partage reseaux sociaux)
□ Sitemap dynamique (/sitemap.xml)
□ robots.txt
□ Google Search Console (guider l'inscription)

=== PAGES SYSTEME ===
□ Page 404 personnalisee (not-found.tsx)
□ Page erreur 500 (error.tsx)

=== PARCOURS UTILISATEUR ===
□ Inscription / connexion fonctionnent correctement
□ Les permissions et roles sont appliques
□ Les formulaires valident et envoient les donnees
□ Les notifications (toast, email) se declenchent
□ Les actions CRUD fonctionnent sur toutes les entites
□ Les endpoints API repondent correctement (tester avec curl ou chrome)

=== VERIFICATION ===
□ Responsive mobile (tester avec claude-in-chrome)
□ Tous les liens fonctionnent
□ Images et assets chargent correctement
□ Recherche fonctionne (si configuree)
□ Profil utilisateur : affichage, edition, parametres
□ Analytics installe (Plausible ou Vercel Analytics)

4. Pour chaque point non fait : l'implementer directement
5. Utiliser claude-in-chrome pour verifier visuellement le resultat :
   - tabs_create_mcp pour ouvrir un onglet
   - navigate vers chaque page modifiee
   - computer (screenshot) pour capturer le resultat
   - get_page_text pour verifier le contenu
   - read_console_messages (pattern: "error") pour verifier les erreurs
6. Cocher au fur et a mesure dans .project/polish.md

7. A la fin, afficher :
   "L'application est prete pour la production !

   [liste des points traites]

   L'app est prete a etre deployee depuis l'interface."

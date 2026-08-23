# GRIST. Migration PMO v2.0

Refonte basée sur le cahier des charges validé.

## Inclus
- chargement d'un JSON source ;
- copie de travail éditable cellule par cellule ;
- export du JSON corrigé ;
- bibliothèque multi-mappings, familles Produit / Projet / Autre ;
- création d'un mapping vide ou prérempli depuis les champs du JSON ;
- mappings multi-tables ;
- choix du type métier par champ ;
- chargement du schéma réel Grist via API ;
- suggestions de correspondance simples basées sur les noms ;
- conservation des cibles non mappées ;
- import/export et édition JSON avancée du mapping ;
- simulation locale non destructive ;
- correction puis re-simulation ;
- garde-fou avant exécution réelle.

## Important
L'exécution réelle d'upserts est volontairement protégée dans cette version : le bouton n'écrit pas encore les données. La prochaine étape consiste à brancher les clés de matching, la comparaison CREATE/UPDATE/SAME et la résolution interactive des Ref avant d'autoriser les écritures.


## v2.1 — éditeur graphique multi-table

- Les connexions sont à nouveau graphiques et manipulables à la souris.
- On choisit n’importe quelle table du schéma Grist chargé.
- Toutes les colonnes de la table sélectionnée restent visibles, même si elles ne sont pas mappées.
- Un même mapping peut viser plusieurs tables différentes.
- Glisser un champ JSON vers une colonne crée une liaison.
- Double-clic ou clic droit sur un trait supprime la liaison.
- Cliquer sur un trait ouvre l’inspecteur de règles.
- Les règles Ref, le type métier et la consigne `identify` restent éditables.


## v2.2
Correction de l'import des mappings historiques au format `fields`, notamment `mapping_produit`. Les propriétés `target_type`, `reference.lookup_column`, `source_fields_without_current_grist_target`, transformations et définitions originales sont préservées lors de la conversion vers l'éditeur graphique.


## v2.3 — correction affichage après import
- `target.table` est toujours ajouté aux tables disponibles ;
- un mapping historique affiche immédiatement ses colonnes cibles connues sans connexion Grist ;
- l'onglet est rendu visible avant le calcul des traits ;
- les traits sont redessinés après mise en page ;
- le canvas ne masque plus les connexions ;
- après connexion Grist, toutes les colonnes réelles de la table remplacent/complètent celles connues du mapping.

## v2.4 — correction définitive import mapping
- suppression des anciens gestionnaires d'import concurrents ;
- un seul importeur compatible `fields` historique et `rules` v2 ;
- affichage immédiat de `target.table` et des colonnes connues sans connexion Grist ;
- diagnostic visible dans l'UI ;
- build `IMPORT v2.4` visible pour éviter les problèmes de cache/déploiement ;
- redessin des traits après affichage réel de l'onglet.

## v2.5 — cache fix
Le JavaScript et le CSS ont été renommés (`migration-v2.5.js`, `migration-v2.5.css`) afin d'empêcher GitHub Pages ou le navigateur de réutiliser une ancienne version de `app.js`. Une signature `BUILD 2.5` est visible en bas à gauche.

## v2.6 — correction du chargement
Cause corrigée : du code résiduel de l'ancien éditeur référençait les éléments `rules` et `addTargetBtn`, supprimés du HTML. Cette erreur JavaScript interrompait l'application avant l'installation du gestionnaire d'import.

La v2.6 :
- supprime le code legacy fautif ;
- conserve uniquement l'éditeur graphique ;
- charge le mapping historique `fields` ;
- affiche `Fonctionnalites` et ses cibles connues sans connexion Grist ;
- utilise de nouveaux noms JS/CSS pour éviter tout cache.

## v2.7 — schéma cible complet
- si le schéma Grist est chargé, toutes les colonnes de la table cible sont toujours affichées, qu'elles soient mappées ou non ;
- filtre `Toutes / Non mappées / Mappées` ;
- recherche par nom/type de colonne ;
- compteur de colonnes visibles ;
- message explicite si seules les colonnes connues par le mapping sont disponibles ;
- tentative automatique de chargement du schéma après import d'un mapping si une connexion Grist est mémorisée.

## v2.8
Trois vues synchronisées du même mapping : graphique, tableau manuel et JSON brut. La vue tableau permet d'ajouter/supprimer et modifier directement les liaisons, tables, colonnes, types et règles Ref.

## v2.9 — transformations
Chaque liaison peut porter une transformation : table de correspondance (ex. XXX → Toto), défaut, préfixe, suffixe, majuscules, minuscules ou trim. La simulation affiche valeur source → valeur transformée.


## v3.0 — Grist intégré

Migration fonctionne maintenant dans le contexte du document Grist courant.

- inclusion de `grist-plugin-api.js`;
- `grist.ready({requiredAccess:"full"})`;
- récupération automatique du nom du document;
- `grist.docApi.listTables()` pour lister les tables;
- lecture de `_grist_Tables` et `_grist_Tables_column` pour construire le schéma complet;
- toutes les tables et colonnes sont immédiatement disponibles dans l'éditeur de mapping;
- lecture des données via `grist.docApi.fetchTable`;
- primitives d'écriture via `grist.docApi.applyUserActions`;
- suppression de la saisie Serveur / Document ID / clé API du parcours normal.

Le moteur d'exécution finale reste protégé tant que le calcul générique CREATE / UPDATE / SAME et la résolution interactive des Ref ne sont pas finalisés.


## v3.1 — Mapping sémantique
Correction UX de l'éditeur graphique :
- la colonne de gauche affiche le vrai `json_field` (`produit`, `categorie`, `fonctionnalite`, `id`...) au lieu des clés techniques historiques (`parent`, `nom`, `code`...) ;
- les traits utilisent également ces noms sémantiques ;
- lorsqu'aucun JSON de travail n'est chargé, l'éditeur affiche un type attendu lisible au lieu de `null` ;
- la table cible conserve toutes ses colonnes visibles, mappées ou non ;
- les champs Produit `categorie` et Projet `module` peuvent pointer vers `Fonctionnalites.Categ_module` ;
- l'inspecteur et la création de nouvelles liaisons travaillent sur le champ JSON réel.


## v3.3.0 — JSON enrichi et valeurs fixes
- Ajout de champs au JSON de travail avant mapping, avec type et valeur commune ou vide.
- Renommage et suppression de champs dans le JSON de travail.
- Export du JSON modifié ; le fichier source chargé reste intact.
- Les nouveaux champs deviennent immédiatement disponibles dans le mapping.
- Nouvelle source de mapping `fixed_value` pour injecter une constante vers n'importe quelle colonne Grist.
- Les valeurs fixes apparaissent dans la vue graphique, l'inspecteur, le JSON brut et la simulation.
- Les transformations existantes s'appliquent aussi aux valeurs fixes.


## v3.4.0 — reconstruction stable
Reprise de la base 3.3 d'origine avec une couche runtime finale unique pour éviter les conflits des anciennes redéfinitions.
Mapping graphique/tableau/JSON, simulation et application Grist sont rebranchés en dernier.
Le package ne contient plus qu'un `migration.js` et un `migration.css` actifs.


## v3.4.1 — activation réelle garantie

Suppression physique de l'ancien handler `Exécution protégée`.
Le bouton `Appliquer réellement dans Grist` est rebranché uniquement sur `applySimulation()`.
La Simulation affiche `✓ Moteur d'application réel v3.4.1 chargé` lorsque le runtime correct est actif.


## v3.4.2 — runtime isolé

Le moteur Simulation/Application est maintenant chargé dans un fichier séparé `migration-runtime.js`,
après le code legacy. Une erreur dans une ancienne couche ne peut donc plus empêcher le runtime final
d'être chargé.

L'écran Simulation affiche toujours :
`✓ Runtime migration v3.4.2 chargé`

Les clics sur `Re-simuler` et `Appliquer réellement dans Grist` sont interceptés en phase capture
pour empêcher tout ancien handler de reprendre la main.


## v3.4.3 — création automatique des références
Les colonnes Ref sont traitées comme références inscriptibles. Si la référence n'existe pas et `create_if_missing=true`, la simulation annonce sa création, puis l'application crée d'abord la ligne référencée, relit son ID et écrit cet ID dans la colonne Ref cible.

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

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

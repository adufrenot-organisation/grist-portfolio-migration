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

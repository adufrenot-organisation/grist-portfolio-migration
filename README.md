# GRIST. Migration PMO — v1.0.0

Module autonome destiné aux opérations de migration et de mapping.

## Import / Export

L'éditeur de mapping Produit a été déplacé depuis l'application Audit.

Il reprend les fonctions de la version Audit v2.3 :

- import d'un `mapping-produit.json`;
- export du mapping modifié;
- validation;
- édition des règles `identify`;
- création, modification et suppression des liaisons;
- glisser-déposer entre champ JSON et colonne Grist;
- gestion des règles `Ref`;
- édition JSON avancée;
- conservation permanente à droite de **toutes les colonnes de la table cible**, même lorsqu'une liaison est supprimée;
- les colonnes non utilisées restent visibles et disponibles pour un nouveau mapping.

Le mapping est conservé localement dans le navigateur sous une clé propre au module Migration.

Ce module ne modifie pas encore les données Grist : il administre le contrat de mapping. Les futures migrations de schéma et de données pourront être ajoutées comme onglets séparés.

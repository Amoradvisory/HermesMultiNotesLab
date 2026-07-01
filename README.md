# Hermes Multi Notes Lab

Application locale simple et fonctionnelle pour la gestion de notes.

## Architecture

### Structure des fichiers

```
HermesMultiNotesLab/
├── src/
│   └── main.py              # Code source principal de l'application
├── data/
│   └── notes.json          # Fichier de stockage des notes (format JSON)
├── assets/
│   └── (icônes, images)
├── docs/
│   └── (documentation)
├── dist/
│   └── (application compilée)
├── config.json             # Configuration de l'application
├── requirements.txt        # Dépendances Python
└── README.md              # Documentation
```

### Format de stockage

Les notes sont stockées au format JSON dans `data/notes.json`. Chaque note contient les champs suivants:

```json
{
  "id": "note_001",
  "title": "Titre de la note",
  "content": "Contenu de la note",
  "tags": ["tag1", "tag2"],
  "created_at": "2026-07-01T10:00:00Z",
  "updated_at": "2026-07-01T10:00:00Z",
  "pinned": false,
  "archived": false
}
```

### Critères de réussite

#### Fonctionnalités minimales requises:
- ✅ Création de notes avec titre et contenu
- ✅ Ajout de tags aux notes
- ✅ Sauvegarde locale en JSON
- ✅ Interface sombre, propre et lisible
- ✅ Export des notes au format JSON
- ✅ Lanceur simple sur le bureau

#### Fonctionnalités avancées optionnelles:
- 🔲 Recherche plein texte
- 🔲 Épinglage de notes
- 🔲 Archivage de notes
- 🔲 Support du format Markdown
- 🔲 Raccourcis clavier
- 🔲 Interface graphique améliorée

## Configuration

L'application est configurée via `config.json`:

- **Thème**: Interface sombre
- **Taille de police**: 14px
- **Taille de fenêtre**: 800x600
- **Auto-sauvegarde**: Activée
- **Backup**: Activée toutes les 5 minutes

## Utilisation

### Lancement de l'application

```bash
python src/main.py
```

### Exemple d'utilisation

```python
from src.main import NoteManager

# Initialiser le gestionnaire
manager = NoteManager()

# Créer une note
note = manager.create_note(
    title="Ma première note",
    content="Contenu de la note",
    tags=["personnel", "important"]
)

# Rechercher des notes
results = manager.search_notes("important")

# Obtenir toutes les notes
all_notes = manager.get_all_notes()
```

## Dépendances

L'application utilise uniquement les bibliothèques standard de Python:
- `json` - Pour le format JSON
- `os` - Pour la gestion des fichiers
- `datetime` - Pour les timestamps
- `typing` - Pour les types

Aucune installation externe n'est requise.

## Export

Les notes peuvent être exportées au format JSON via la fonction `export_notes()`:

```python
export_data = manager.export_notes()
# Sauvegarder dans un fichier
with open("export.json", "w", encoding="utf-8") as f:
    json.dump(export_data, f, indent=2, ensure_ascii=False)
```

## Développement

### Ajouter de nouvelles fonctionnalités

1. Modifier la classe `NoteManager` dans `src/main.py`
2. Mettre à jour le `config.json` si nécessaire
3. Tester les nouvelles fonctionnalités
4. Documenter les changements

### Bonnes pratiques

- Utiliser des noms de variables clairs
- Documenter les fonctions avec des docstrings
- Gérer les erreurs de manière appropriée
- Sauvegarder les données après chaque modification
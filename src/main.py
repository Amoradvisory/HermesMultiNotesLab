#!/usr/bin/env python3
"""
Hermes Multi Notes Lab - Application principale avec interface graphique
Version 1.0.0

Application complète de prise de notes avec interface utilisateur graphique.
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
import threading


class NoteManager:
    """Gestionnaire de notes pour l'application Hermes Multi Notes Lab"""
    
    def __init__(self, notes_file: str = "data/notes.json"):
        self.notes_file = notes_file
        self.notes: List[Dict] = []
        self.load_notes()
    
    def load_notes(self) -> None:
        """Charger les notes depuis le fichier JSON"""
        try:
            if os.path.exists(self.notes_file):
                with open(self.notes_file, 'r', encoding='utf-8') as f:
                    self.notes = json.load(f)
            else:
                self.notes = []
        except (json.JSONDecodeError, IOError) as e:
            print(f"Erreur lors du chargement des notes: {e}")
            self.notes = []
    
    def save_notes(self) -> None:
        """Sauvegarder les notes dans le fichier JSON"""
        try:
            os.makedirs(os.path.dirname(self.notes_file), exist_ok=True)
            with open(self.notes_file, 'w', encoding='utf-8') as f:
                json.dump(self.notes, f, indent=2, ensure_ascii=False)
        except IOError as e:
            print(f"Erreur lors de la sauvegarde des notes: {e}")
    
    def create_note(self, title: str, content: str, tags: List[str] = None) -> Dict:
        """Créer une nouvelle note"""
        note = {
            "id": f"note_{len(self.notes) + 1:03d}",
            "title": title,
            "content": content,
            "tags": tags or [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "pinned": False,
            "archived": False
        }
        self.notes.append(note)
        self.save_notes()
        return note
    
    def get_note(self, note_id: str) -> Optional[Dict]:
        """Obtenir une note par son ID"""
        for note in self.notes:
            if note["id"] == note_id:
                return note
        return None
    
    def update_note(self, note_id: str, title: str = None, content: str = None, tags: List[str] = None) -> bool:
        """Mettre à jour une note existante"""
        note = self.get_note(note_id)
        if not note:
            return False
        
        if title is not None:
            note["title"] = title
        if content is not None:
            note["content"] = content
        if tags is not None:
            note["tags"] = tags
        
        note["updated_at"] = datetime.now().isoformat()
        self.save_notes()
        return True
    
    def delete_note(self, note_id: str) -> bool:
        """Supprimer une note"""
        for i, note in enumerate(self.notes):
            if note["id"] == note_id:
                del self.notes[i]
                self.save_notes()
                return True
        return False
    
    def search_notes(self, query: str) -> List[Dict]:
        """Rechercher des notes par titre ou contenu"""
        query_lower = query.lower()
        results = []
        
        for note in self.notes:
            if (query_lower in note["title"].lower() or 
                query_lower in note["content"].lower() or
                any(query_lower in tag.lower() for tag in note["tags"])):
                results.append(note)
        
        return results
    
    def get_all_notes(self) -> List[Dict]:
        """Obtenir toutes les notes"""
        return sorted(self.notes, key=lambda x: x["updated_at"], reverse=True)
    
    def get_pinned_notes(self) -> List[Dict]:
        """Obtenir les notes épinglées"""
        return [note for note in self.notes if note["pinned"]]
    
    def get_tags(self) -> List[str]:
        """Obtenir tous les tags uniques"""
        all_tags = set()
        for note in self.notes:
            all_tags.update(note["tags"])
        return sorted(list(all_tags))
    
    def toggle_pin_note(self, note_id: str) -> bool:
        """Basculer l'état d'épinglage d'une note"""
        note = self.get_note(note_id)
        if note:
            note["pinned"] = not note["pinned"]
            note["updated_at"] = datetime.now().isoformat()
            self.save_notes()
            return True
        return False
    
    def export_notes(self, filepath: str = None) -> Dict:
        """Exporter les notes au format JSON"""
        if filepath is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = f"export_notes_{timestamp}.json"
        
        export_data = {
            "export_metadata": {
                "timestamp": datetime.now().isoformat(),
                "total_notes": len(self.notes),
                "format": "json",
                "app": "Hermes Multi Notes Lab"
            },
            "notes": self.notes
        }
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
            return {"success": True, "filepath": filepath}
        except IOError as e:
            return {"success": False, "error": str(e)}


class HermesNotesGUI:
    """Interface graphique pour Hermes Multi Notes Lab"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("Hermes Multi Notes Lab")
        self.root.geometry("900x700")
        
        # Configuration du thème sombre
        self.setup_dark_theme()
        
        # Initialisation du gestionnaire de notes
        self.note_manager = NoteManager()
        
        # Variables GUI
        self.selected_note_id = None
        self.search_var = tk.StringVar()
        self.filter_var = tk.StringVar(value="all")
        
        # Création de l'interface
        self.create_widgets()
        
        # Charger les notes initiales
        self.refresh_notes_list()
        
        # Message positif discret
        self.show_positive_message()
    
    def setup_dark_theme(self):
        """Configurer le thème sombre"""
        style = ttk.Style()
        
        # Configuration des couleurs sombres
        self.colors = {
            'bg': '#2b2b2b',
            'fg': '#ffffff',
            'entry_bg': '#3c3c3c',
            'button_bg': '#404040',
            'button_fg': '#ffffff',
            'list_bg': '#3c3c3c',
            'list_fg': '#ffffff',
            'list_select': '#555555',
            'frame_bg': '#2b2b2b'
        }
        
        # Configurer le style ttk
        style.theme_use('clam')
        style.configure('TFrame', background=self.colors['frame_bg'])
        style.configure('TLabel', background=self.colors['frame_bg'], foreground=self.colors['fg'])
        style.configure('TButton', background=self.colors['button_bg'], foreground=self.colors['button_fg'])
        style.configure('TEntry', fieldbackground=self.colors['entry_bg'], foreground=self.colors['fg'])
        style.configure('TCombobox', fieldbackground=self.colors['entry_bg'], foreground=self.colors['fg'])
        style.configure('TListbox', background=self.colors['list_bg'], foreground=self.colors['fg'])
        style.configure('TScrollbar', background=self.colors['button_bg'])
        
        # Configurer la fenêtre principale
        self.root.configure(bg=self.colors['frame_bg'])
    
    def create_widgets(self):
        """Créer tous les widgets de l'interface"""
        # Frame principal
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Barre de recherche et filtres
        search_frame = ttk.Frame(main_frame)
        search_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(search_frame, text="Rechercher:").pack(side=tk.LEFT, padx=(0, 5))
        self.search_entry = ttk.Entry(search_frame, textvariable=self.search_var, width=40)
        self.search_entry.pack(side=tk.LEFT, padx=(0, 10))
        self.search_entry.bind('<KeyRelease>', self.on_search)
        
        ttk.Label(search_frame, text="Filtrer:").pack(side=tk.LEFT, padx=(0, 5))
        self.filter_combo = ttk.Combobox(search_frame, textvariable=self.filter_var, 
                                       values=["all", "pinned", "archived"], width=15, state="readonly")
        self.filter_combo.pack(side=tk.LEFT)
        self.filter_combo.bind('<<ComboboxSelected>>', self.on_filter_change)
        
        # Boutons d'actions
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(button_frame, text="Nouvelle note", command=self.new_note).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="Éditer", command=self.edit_note).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="Supprimer", command=self.delete_note).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="Épingler", command=self.toggle_pin).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="Exporter", command=self.export_notes).pack(side=tk.LEFT, padx=(0, 5))
        
        # Frame principal avec deux colonnes
        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True)
        
        # Liste des notes (gauche)
        list_frame = ttk.Frame(content_frame)
        list_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))
        
        ttk.Label(list_frame, text="Notes").pack(anchor=tk.W)
        
        # Scrollbar pour la liste
        scrollbar = ttk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Liste des notes
        self.notes_listbox = tk.Listbox(list_frame, yscrollcommand=scrollbar.set, 
                                       bg=self.colors['list_bg'], fg=self.colors['fg'],
                                       selectbackground=self.colors['list_select'])
        self.notes_listbox.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.notes_listbox.yview)
        
        self.notes_listbox.bind('<<ListboxSelect>>', self.on_note_select)
        
        # Détails de la note (droite)
        details_frame = ttk.Frame(content_frame)
        details_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0))
        
        ttk.Label(details_frame, text="Détails de la note").pack(anchor=tk.W)
        
        # Informations de la note
        info_frame = ttk.Frame(details_frame)
        info_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.title_label = ttk.Label(info_frame, text="Titre:", font=('Arial', 10, 'bold'))
        self.title_label.pack(anchor=tk.W)
        
        self.content_text = scrolledtext.ScrolledText(details_frame, height=15, width=50,
                                                     bg=self.colors['entry_bg'], fg=self.colors['fg'])
        self.content_text.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        self.content_text.config(state=tk.DISABLED)
        
        # Tags
        tags_frame = ttk.Frame(details_frame)
        tags_frame.pack(fill=tk.X)
        
        ttk.Label(tags_frame, text="Tags:").pack(anchor=tk.W)
        self.tags_label = ttk.Label(tags_frame, text="", wraplength=400)
        self.tags_label.pack(anchor=tk.W)
        
        # Métadonnées
        metadata_frame = ttk.Frame(details_frame)
        metadata_frame.pack(fill=tk.X, pady=(10, 0))
        
        self.metadata_label = ttk.Label(metadata_frame, text="", font=('Arial', 8))
        self.metadata_label.pack(anchor=tk.W)
    
    def show_positive_message(self):
        """Afficher un message positif discret"""
        message_frame = ttk.Frame(self.root)
        message_frame.pack(fill=tk.X, padx=10, pady=(0, 5))
        
        positive_messages = [
            "✨ Organisation inspirante pour vos idées",
            "🌟 Chaque note est une étape vers la clarté",
            "💭 Pensez librement, organisez intelligemment",
            "🚀 Transformez vos idées en actions"
        ]
        
        import random
        message = random.choice(positive_messages)
        
        ttk.Label(message_frame, text=message, font=('Arial', 9, 'italic'),
                 foreground='#90EE90').pack(anchor=tk.E)
    
    def refresh_notes_list(self):
        """Rafraîchir la liste des notes"""
        self.notes_listbox.delete(0, tk.END)
        
        filter_type = self.filter_var.get()
        search_query = self.search_var.get().lower()
        
        notes_to_display = []
        
        if filter_type == "all":
            notes_to_display = self.note_manager.get_all_notes()
        elif filter_type == "pinned":
            notes_to_display = self.note_manager.get_pinned_notes()
        elif filter_type == "archived":
            notes_to_display = [note for note in self.note_manager.notes if note["archived"]]
        
        # Appliquer la recherche
        if search_query:
            notes_to_display = self.note_manager.search_notes(search_query)
        
        for note in notes_to_display:
            prefix = "📌 " if note["pinned"] else ""
            title = note["title"][:50] + "..." if len(note["title"]) > 50 else note["title"]
            self.notes_listbox.insert(tk.END, f"{prefix}{title}")
    
    def on_search(self, event=None):
        """Gérer les événements de recherche"""
        self.refresh_notes_list()
    
    def on_filter_change(self, event=None):
        """Gérer les changements de filtre"""
        self.refresh_notes_list()
    
    def on_note_select(self, event=None):
        """Gérer la sélection d'une note"""
        selection = self.notes_listbox.curselection()
        if selection:
            index = selection[0]
            filter_type = self.filter_var.get()
            search_query = self.search_var.get().lower()
            
            # Obtenir la note correspondante
            notes_to_display = []
            if filter_type == "all":
                notes_to_display = self.note_manager.get_all_notes()
            elif filter_type == "pinned":
                notes_to_display = self.note_manager.get_pinned_notes()
            elif filter_type == "archived":
                notes_to_display = [note for note in self.note_manager.notes if note["archived"]]
            
            if search_query:
                notes_to_display = self.note_manager.search_notes(search_query)
            
            if index < len(notes_to_display):
                selected_note = notes_to_display[index]
                self.selected_note_id = selected_note["id"]
                self.display_note_details(selected_note)
    
    def display_note_details(self, note):
        """Afficher les détails d'une note"""
        self.title_label.config(text=f"Titre: {note['title']}")
        
        self.content_text.config(state=tk.NORMAL)
        self.content_text.delete(1.0, tk.END)
        self.content_text.insert(1.0, note['content'])
        self.content_text.config(state=tk.DISABLED)
        
        # Afficher les tags
        tags_text = ", ".join(note['tags']) if note['tags'] else "Aucun tag"
        self.tags_label.config(text=tags_text)
        
        # Afficher les métadonnées
        created_date = datetime.fromisoformat(note['created_at']).strftime("%d/%m/%Y %H:%M")
        updated_date = datetime.fromisoformat(note['updated_at']).strftime("%d/%m/%Y %H:%M")
        metadata_text = f"Créée: {created_date} | Modifiée: {updated_date} | ID: {note['id']}"
        if note['pinned']:
            metadata_text += " | 📌 Épinglée"
        if note['archived']:
            metadata_text += " | 📁 Archivée"
        
        self.metadata_label.config(text=metadata_text)
    
    def new_note(self):
        """Créer une nouvelle note"""
        dialog = NoteDialog(self.root, "Nouvelle note", "", [])
        if dialog.result:
            title, content, tags = dialog.result
            self.note_manager.create_note(title, content, tags)
            self.refresh_notes_list()
            messagebox.showinfo("Succès", "Note créée avec succès!")
    
    def edit_note(self):
        """Éditer la note sélectionnée"""
        if not self.selected_note_id:
            messagebox.showwarning("Avertissement", "Veuillez sélectionner une note à éditer.")
            return
        
        note = self.note_manager.get_note(self.selected_note_id)
        if note:
            dialog = NoteDialog(self.root, "Éditer la note", note['content'], note['tags'])
            if dialog.result:
                title, content, tags = dialog.result
                self.note_manager.update_note(self.selected_note_id, title, content, tags)
                self.refresh_notes_list()
                messagebox.showinfo("Succès", "Note modifiée avec succès!")
    
    def delete_note(self):
        """Supprimer la note sélectionnée"""
        if not self.selected_note_id:
            messagebox.showwarning("Avertissement", "Veuillez sélectionner une note à supprimer.")
            return
        
        note = self.note_manager.get_note(self.selected_note_id)
        if note:
            if messagebox.askyesno("Confirmation", f"Êtes-vous sûr de vouloir supprimer la note '{note['title']}'?"):
                self.note_manager.delete_note(self.selected_note_id)
                self.refresh_notes_list()
                self.selected_note_id = None
                # Effacer les détails
                self.title_label.config(text="Titre:")
                self.content_text.config(state=tk.NORMAL)
                self.content_text.delete(1.0, tk.END)
                self.content_text.config(state=tk.DISABLED)
                self.tags_label.config(text="")
                self.metadata_label.config(text="")
                messagebox.showinfo("Succès", "Note supprimée avec succès!")
    
    def toggle_pin(self):
        """Basculer l'épinglage de la note sélectionnée"""
        if not self.selected_note_id:
            messagebox.showwarning("Avertissement", "Veuillez sélectionner une note à épingler/dépingler.")
            return
        
        note = self.note_manager.get_note(self.selected_note_id)
        if note:
            self.note_manager.toggle_pin_note(self.selected_note_id)
            self.refresh_notes_list()
            status = "épinglée" if note["pinned"] else "dépinglée"
            messagebox.showinfo("Succès", f"Note {status} avec succès!")
    
    def export_notes(self):
        """Exporter les notes au format JSON"""
        filepath = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("Fichiers JSON", "*.json"), ("Tous les fichiers", "*.*")],
            initialfile=f"hermes_notes_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        
        if filepath:
            result = self.note_manager.export_notes(filepath)
            if result["success"]:
                messagebox.showinfo("Succès", f"Notes exportées avec succès vers:\n{result['filepath']}")
            else:
                messagebox.showerror("Erreur", f"Erreur lors de l'export:\n{result['error']}")


class NoteDialog:
    """Dialogue pour la création/édition de notes"""
    
    def __init__(self, parent, title, content, tags):
        self.result = None
        
        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.geometry("500x400")
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        # Frame principal
        main_frame = ttk.Frame(self.dialog)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Champ titre
        ttk.Label(main_frame, text="Titre:").pack(anchor=tk.W)
        self.title_entry = ttk.Entry(main_frame, width=60)
        self.title_entry.pack(fill=tk.X, pady=(0, 10))
        
        # Champ contenu
        ttk.Label(main_frame, text="Contenu:").pack(anchor=tk.W)
        self.content_text = scrolledtext.ScrolledText(main_frame, height=15, width=60)
        self.content_text.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        # Champ tags
        ttk.Label(main_frame, text="Tags (séparés par des virgules):").pack(anchor=tk.W)
        self.tags_entry = ttk.Entry(main_frame, width=60)
        self.tags_entry.pack(fill=tk.X, pady=(0, 10))
        
        # Boutons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)
        
        ttk.Button(button_frame, text="OK", command=self.ok_clicked).pack(side=tk.RIGHT, padx=(5, 0))
        ttk.Button(button_frame, text="Annuler", command=self.cancel_clicked).pack(side=tk.RIGHT)
        
        # Remplir avec les données existantes
        self.title_entry.insert(0, title)
        self.content_text.insert(1.0, content)
        self.tags_entry.insert(0, ", ".join(tags))
        
        # Attendre la fermeture
        self.dialog.wait_window()
    
    def ok_clicked(self):
        """Gérer le clic sur OK"""
        title = self.title_entry.get().strip()
        content = self.content_text.get(1.0, tk.END).strip()
        tags = [tag.strip() for tag in self.tags_entry.get().split(",") if tag.strip()]
        
        if title and content:
            self.result = (title, content, tags)
            self.dialog.destroy()
        else:
            messagebox.showwarning("Avertissement", "Le titre et le contenu sont obligatoires.")
    
    def cancel_clicked(self):
        """Gérer le clic sur Annuler"""
        self.dialog.destroy()


def main():
    """Fonction principale de l'application"""
    root = tk.Tk()
    app = HermesNotesGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
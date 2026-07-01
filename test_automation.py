#!/usr/bin/env python3
"""
Script de test automatisé pour Hermes Multi Notes Lab
Valide la persistance des données et les fonctionnalités de base
"""

import json
import os
import sys
import time
from datetime import datetime

# Ajouter le chemin de l'application
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def test_persistence():
    """Tester la persistance des données"""
    print("=== TEST DE PERSISTANCE DES DONNÉES ===")
    
    notes_file = "data/notes.json"
    
    # Sauvegarder l'état initial
    with open(notes_file, 'r', encoding='utf-8') as f:
        initial_data = json.load(f)
    
    print(f"État initial: {len(initial_data)} notes")
    
    # Créer de nouvelles notes pour le test
    from main import NoteManager
    
    manager = NoteManager()
    
    # Test 1: Créer de nouvelles notes
    print("\n--- Test 1: Création de notes ---")
    note1 = manager.create_note(
        title="Test de Persistance 1",
        content="Cette note a été créée pour tester la persistance",
        tags=["test", "persistance"]
    )
    print(f"✅ Note créée: {note1['id']}")
    
    note2 = manager.create_note(
        title="Test de Persistance 2",
        content="Contenu de la deuxième note de test",
        tags=["test", "validation"]
    )
    print(f"✅ Note créée: {note2['id']}")
    
    # Vérifier le nombre de notes
    all_notes = manager.get_all_notes()
    print(f"Total après création: {len(all_notes)} notes")
    
    # Test 2: Modifier une note
    print("\n--- Test 2: Modification de note ---")
    manager.update_note(note1['id'], 
                      title="Test de Persistance (Modifié)",
                      content="Contenu modifié pour le test")
    print(f"✅ Note modifiée: {note1['id']}")
    
    # Test 3: Épingler une note
    print("\n--- Test 3: Épinglage de note ---")
    manager.toggle_pin_note(note2['id'])
    print(f"✅ Note épinglée: {note2['id']}")
    
    # Vérifier l'état final
    final_notes = manager.get_all_notes()
    print(f"\nÉtat final: {len(final_notes)} notes")
    
    # Sauvegarder l'état final dans un fichier de test
    test_export = {
        "test_metadata": {
            "timestamp": datetime.now().isoformat(),
            "test_type": "persistence_test",
            "total_notes": len(final_notes)
        },
        "notes": final_notes
    }
    
    with open("data/persistence_test.json", 'w', encoding='utf-8') as f:
        json.dump(test_export, f, indent=2, ensure_ascii=False)
    
    print("✅ Fichier de test de persistance créé: data/persistence_test.json")
    
    return len(initial_data), len(final_notes)

def test_search_functionality():
    """Tester la fonctionnalité de recherche"""
    print("\n=== TEST DE FONCTIONNALITÉ DE RECHERCHE ===")
    
    from main import NoteManager
    
    manager = NoteManager()
    
    # Test 1: Recherche par titre
    print("\n--- Test 1: Recherche par titre ---")
    results = manager.search_notes("persistance")
    print(f"Résultats recherche 'persistance': {len(results)} notes")
    
    # Test 2: Recherche par contenu
    print("\n--- Test 2: Recherche par contenu ---")
    results = manager.search_notes("contenu")
    print(f"Résultats recherche 'contenu': {len(results)} notes")
    
    # Test 3: Recherche par tag
    print("\n--- Test 3: Recherche par tag ---")
    results = manager.search_notes("test")
    print(f"Résultats recherche 'test': {len(results)} notes")
    
    return len(results)

def test_export_functionality():
    """Tester la fonctionnalité d'export"""
    print("\n=== TEST DE FONCTIONNALITÉ D'EXPORT ===")
    
    from main import NoteManager
    
    manager = NoteManager()
    
    # Exporter les notes
    result = manager.export_notes("data/test_export.json")
    
    if result["success"]:
        print(f"✅ Export réussi: {result['filepath']}")
        
        # Vérifier le fichier exporté
        with open(result['filepath'], 'r', encoding='utf-8') as f:
            exported_data = json.load(f)
        
        print(f"✅ Fichier exporté valide: {len(exported_data['notes'])} notes")
        return True
    else:
        print(f"❌ Échec de l'export: {result['error']}")
        return False

def main():
    """Fonction principale du test"""
    print("DÉBUT DES TESTS AUTOMATISÉS")
    print("=" * 50)
    
    try:
        # Tester la persistance
        initial_count, final_count = test_persistence()
        
        # Tester la recherche
        search_results = test_search_functionality()
        
        # Tester l'export
        export_success = test_export_functionality()
        
        # Résumé des tests
        print("\n" + "=" * 50)
        print("RÉSUMÉ DES TESTS")
        print("=" * 50)
        print(f"✅ Persistance: {final_count - initial_count} notes ajoutées")
        print(f"✅ Recherche: {search_results} résultats trouvés")
        print(f"✅ Export: {'Succès' if export_success else 'Échec'}")
        
        if final_count > initial_count and search_results > 0 and export_success:
            print("\n🎉 TOUS LES TESTS SONT RÉUSSIS!")
            print("L'application Hermes Multi Notes Lab est fonctionnelle.")
            return 0
        else:
            print("\n❌ Certains tests ont échoué.")
            return 1
            
    except Exception as e:
        print(f"\n❌ ERREUR DURANT LES TESTS: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
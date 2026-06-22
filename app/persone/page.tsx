"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Interfacce aggiornate coi nomi esatti del tuo DB
interface Persona {
  id: number;
  name: string;
  role: number; // Ora è un numero (Foreign Key)
  group: string;
}

interface Ruolo {
  id: number;
  nome: string; // Nella tabella Ruoli la colonna si chiama "nome"
}

export default function PersonePage() {
  const [persone, setPersone] = useState<Persona[]>([]);
  const [ruoli, setRuoli] = useState<Ruolo[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ project_id: "", type: "Dev", hours: "", note: "" });

  // formData usa i nomi in inglese. "role" lo teniamo come stringa temporanea per la tendina <select>
  const [formData, setFormData] = useState({ name: "", role: "", group: "" });

  const fetchData = async () => {
    setLoading(true);
    
    // Tabella Persone
    const { data: dataPersone, error: errorPersone } = await supabase
      .from("Persone")
      .select("*")
      .order("id", { ascending: true });

    if (errorPersone) console.error("Errore persone:", errorPersone);
    else setPersone(dataPersone || []);

    // Tabella Ruoli
    const { data: dataRuoli, error: errorRuoli } = await supabase
      .from("Ruoli") 
      .select("*")
      .order("nome", { ascending: true });

    if (errorRuoli) console.error("Errore ruoli:", errorRuoli);
    else setRuoli(dataRuoli || []);

    // Tabella Project (per selezione nel popup di registrazione ore)
    const { data: dataProjects, error: errorProjects } = await supabase
      .from("Project")
      .select("id, name, dev_remaining_h, bugfix_remaining_h")
      .order("id", { ascending: true });

    if (errorProjects) console.error("Errore progetti:", errorProjects);
    else setProjects(dataProjects || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openFormModal = (persona: Persona | null = null) => {
    if (persona) {
      setCurrentPersona(persona);
      setFormData({ 
        name: persona.name, 
        role: persona.role.toString(), // Convertiamo in stringa per la tendina
        group: persona.group 
      });
    } else {
      setCurrentPersona(null);
      // Per l'inserimento iniziale nessun ruolo è selezionato di default
      setFormData({ 
        name: "", 
        role: "", 
        group: "" 
      });
    }
    setIsFormOpen(true);
  };

  const openLogModal = (persona: Persona) => {
    setCurrentPersona(persona);
    setLogForm({ project_id: projects.length > 0 ? projects[0].id.toString() : "", type: "Dev", hours: "", note: "" });
    setIsLogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Creiamo l'oggetto da salvare, convertendo il ruolo di nuovo in Numero!
    const payload = {
      name: formData.name,
      role: Number(formData.role), 
      group: formData.group
    };

    if (currentPersona) {
      const { error } = await supabase
        .from("Persone")
        .update(payload)
        .eq("id", currentPersona.id);

      if (error) alert("Errore durante l'aggiornamento: " + error.message);
    } else {
      const { error } = await supabase
        .from("Persone")
        .insert([payload]);

      if (error) alert("Errore durante l'inserimento: " + error.message);
    }

    setIsFormOpen(false);
    fetchData(); 
  };

  const openDeleteModal = (persona: Persona) => {
    setCurrentPersona(persona);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!currentPersona) return;

    const { error } = await supabase
      .from("Persone")
      .delete()
      .eq("id", currentPersona.id);

    if (error) {
      alert("Errore durante l'eliminazione: " + error.message);
    } else {
      setIsDeleteOpen(false);
      fetchData();
    }
  };

  // Funzione per mostrare il nome del ruolo nella tabella partendo dal suo ID
  const getNomeRuolo = (ruoloId: number) => {
    const ruoloTrovato = ruoli.find((r) => r.id === ruoloId);
    return ruoloTrovato ? ruoloTrovato.nome : "Sconosciuto";
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestione Persone</h1>
          <p className="text-gray-500 text-sm">Lista del personale e assegnazione ruoli</p>
        </div>
        <button
          onClick={() => openFormModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow"
        >
          + Inserisci Nuovo
        </button>
      </div>

      {/* --- TABELLA --- */}
      {loading ? (
        <p className="text-center py-10 text-gray-500">Caricamento in corso...</p>
      ) : persone.length === 0 ? (
        <p className="text-center py-10 text-gray-500 bg-white border rounded-xl">Nessuna persona inserita al momento.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ruolo</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Gruppo</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {persone.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {/* Usiamo la funzione per stampare il Nome del ruolo invece dell'ID */}
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {getNomeRuolo(p.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.group}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right space-x-3">
                    <button onClick={() => openFormModal(p)} className="text-amber-600 hover:text-amber-700 transition-colors">Modifica</button>
                    <button onClick={() => openDeleteModal(p)} className="text-red-600 hover:text-red-700 transition-colors">Elimina</button>
                    <button onClick={() => openLogModal(p)} className="text-indigo-600 hover:text-indigo-700 transition-colors">Registra Ore</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- POPUP INSERIMENTO / MODIFICA --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-4 relative border">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {currentPersona ? "Modifica Persona" : "Nuova Persona"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Es. Mario Rossi"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Ruolo</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="" disabled>Seleziona un ruolo...</option>
                  {/* Salviamo l'ID del ruolo (r.id) come valore, ma mostriamo il nome (r.nome) all'utente */}
                  {ruoli.map((r) => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Gruppo</label>
                <input
                  type="text"
                  required
                  value={formData.group}
                  onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Es. Team Alpha, Frontend, ecc."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP REGISTRA ORE --- */}
      {isLogOpen && currentPersona && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-4 relative border">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Registra Ore per {currentPersona.name}</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              // Salva le ore decrementando il campo corrispondente nel progetto
              const projectId = Number(logForm.project_id);
              const hours = Number(logForm.hours);
              if (!projectId || !hours || hours <= 0) return alert('Inserisci progetto e ore valide');

              // Recupera l'effort iniziale e il remaining corrente
              const { data: projData, error: projErr } = await supabase
                .from('Project')
                .select('id, dev_effort_h, bugfix_effort_h, dev_remaining_h, bugfix_remaining_h')
                .eq('id', projectId)
                .single();
              if (projErr || !projData) return alert('Errore recupero progetto: ' + (projErr?.message || 'nessun dato'));

              const field = logForm.type === 'Dev' ? 'dev_remaining_h' : 'bugfix_remaining_h';
              const initialField = logForm.type === 'Dev' ? 'dev_effort_h' : 'bugfix_effort_h';
              const initialEffort = Number(projData[initialField] ?? 0);
              const prevRemaining = Number(projData[field] ?? 0);

              // NON consideriamo i TimeLogs esistenti: il remaining deve essere initialEffort - ore_inserite
              const newRemaining = Math.max(0, initialEffort - hours);

              const { error: updateErr } = await supabase.from('Project').update({ [field]: newRemaining }).eq('id', projectId);
              if (updateErr) return alert('Errore aggiornamento progetto: ' + updateErr.message);

              // Inserisci un TimeLog per tracciare la registrazione (non usato per il calcolo del remaining)
              const { error: insertErr } = await supabase.from('TimeLogs').insert([{ person_id: currentPersona.id, project_id: projectId, type: logForm.type, hours: hours, note: logForm.note }]);
              if (insertErr) {
                // rollback del valore remaining se il log non è stato creato
                await supabase.from('Project').update({ [field]: prevRemaining }).eq('id', projectId);
                return alert('Errore registrazione log: ' + insertErr.message + '. Operazione annullata.');
              }

              setIsLogOpen(false);
              setLogForm({ project_id: "", type: "Dev", hours: "", note: "" });
              fetchData();
              alert('Ore registrate e remaining aggiornato');
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Progetto</label>
                <select required value={logForm.project_id} onChange={(e) => setLogForm({ ...logForm, project_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                  <option value="" disabled>Seleziona un progetto...</option>
                  {projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>{pr.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Tipo</label>
                <select required value={logForm.type} onChange={(e) => setLogForm({ ...logForm, type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                  <option value="Dev">Dev</option>
                  <option value="Bugfix">Bugfix</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Ore</label>
                <input required type="number" step="0.25" min="0" value={logForm.hours} onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900" placeholder="Es. 2.5" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nota (opzionale)</label>
                <input type="text" value={logForm.note} onChange={(e) => setLogForm({ ...logForm, note: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900" placeholder="Es. Lavoro su ticket #123" />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsLogOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">Registra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP ELIMINAZIONE --- */}
      {isDeleteOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 m-4 relative border">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Conferma Eliminazione</h2>
            <p className="text-sm text-gray-600 mb-6">
              Sei sicuro di voler eliminare <span className="font-semibold">{currentPersona?.name}</span>?
            </p>
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
              <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">Sì, Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
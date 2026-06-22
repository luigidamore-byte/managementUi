"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Interfaccia del Progetto aggiornata al nuovo database
interface Progetto {
  id: number;
  name: string;
  release_id: number; // La Foreign Key che punta alla Release
  // nuovi campi in ore (h)
  dev_effort_h?: number;
  bugfix_effort_h?: number;
  tl_effort_h?: number;
  // nuovi campi remaining in ore (h)
  dev_remaining_h?: number;
  bugfix_remaining_h?: number;
  tl_remaining_h?: number;
}

// Interfaccia della Release madre
interface Release {
  id: number;
  name: string;
  release_number: string;
  release_date: string;
}

interface MasterplanPhase {
  id: number;
  release_id: number;
  phase_name: string;
  start_date: string;
  end_date: string;
}

export default function ProgettiPage() {
  const [progetti, setProgetti] = useState<Progetto[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [masterplan, setMasterplan] = useState<MasterplanPhase[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentProgetto, setCurrentProgetto] = useState<Progetto | null>(null);

  // Stato iniziale del form
  const [formData, setFormData] = useState({
    name: "",
    release_id: "", // ID della tendina
    dev_effort_h: "",
    bugfix_effort_h: "",
    tl_effort_h: "",
    dev_remaining_h: "",
    bugfix_remaining_h: "",
    tl_remaining_h: "",
  });

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Scarichiamo le Release (per popolare la tendina)
    const { data: releasesData, error: errRel } = await supabase
      .from("Release")
      .select("*")
      .order("release_date", { ascending: true });

    if (errRel) console.error("Errore release:", errRel);
    else setReleases(releasesData || []);

    // 2. Scarichiamo il Masterplan per lo stato delle release
    const { data: masterplanData, error: errMasterplan } = await supabase
      .from("Masterplan")
      .select("*");

    if (errMasterplan) console.error("Errore masterplan:", errMasterplan);
    else setMasterplan(masterplanData || []);

    // 3. Scarichiamo i Progetti
    const { data: progettiData, error: errProj } = await supabase
      .from("Project")
      .select("*")
      .order("id", { ascending: true });

    if (errProj) console.error("Errore progetti:", errProj);
    else setProgetti(progettiData || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openFormModal = (progetto: Progetto | null = null) => {
    if (progetto) {
      setCurrentProgetto(progetto);
      const conv = (md?: number, h?: number) => (h ?? (md ? md * 8 : 0));
      setFormData({
        name: progetto.name,
        release_id: progetto.release_id?.toString() || "",
        dev_effort_h: conv(progetto.dev_effort, progetto.dev_effort_h).toString(),
        bugfix_effort_h: conv(progetto.bugfix_effort, progetto.bugfix_effort_h).toString(),
        tl_effort_h: conv(progetto.tl_effort, progetto.tl_effort_h).toString(),
        dev_remaining_h: (progetto.dev_remaining_h ?? conv(progetto.dev_effort, progetto.dev_effort_h)).toString(),
        bugfix_remaining_h: (progetto.bugfix_remaining_h ?? conv(progetto.bugfix_effort, progetto.bugfix_effort_h)).toString(),
        tl_remaining_h: (progetto.tl_remaining_h ?? conv(progetto.tl_effort, progetto.tl_effort_h)).toString(),
      });
    } else {
      setCurrentProgetto(null);
      setFormData({
        name: "",
        release_id: releases.length > 0 ? releases[0].id.toString() : "", // Pre-seleziona la prima se esiste
        dev_effort_h: "",
        bugfix_effort_h: "",
        tl_effort_h: "",
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      release_id: formData.release_id ? Number(formData.release_id) : null,
      dev_effort_h: Number(formData.dev_effort_h),
      bugfix_effort_h: Number(formData.bugfix_effort_h),
      tl_effort_h: Number(formData.tl_effort_h),
      dev_remaining_h: Number(formData.dev_remaining_h),
      bugfix_remaining_h: Number(formData.bugfix_remaining_h),
      tl_remaining_h: Number(formData.tl_remaining_h),
    };

    if (currentProgetto) {
      const { error } = await supabase
        .from("Project")
        .update(payload)
        .eq("id", currentProgetto.id);

      if (error) alert("Errore durante l'aggiornamento: " + error.message);
    } else {
      const { error } = await supabase
        .from("Project")
        .insert([payload]);

      if (error) alert("Errore durante l'inserimento: " + error.message);
    }

    setIsFormOpen(false);
    fetchData();
  };

  const openDeleteModal = (progetto: Progetto) => {
    setCurrentProgetto(progetto);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!currentProgetto) return;

    const { error } = await supabase
      .from("Project")
      .delete()
      .eq("id", currentProgetto.id);

    if (error) {
      alert("Errore durante l'eliminazione: " + error.message);
    } else {
      setIsDeleteOpen(false);
      fetchData();
    }
  };

  // Funzioni di supporto per mostrare i dati della Release in tabella
  const formattaData = (dataString: string | undefined) => {
    if (!dataString) return "-";
    const [year, month, day] = dataString.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatHoursValue = (val?: number) => {
    if (val === undefined || val === null) return "0 h";
    const fixed = Number(val).toFixed(2);
    const trimmed = fixed.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, "");
    return `${trimmed} h`;
  };

  const getReleaseInfo = (releaseId: number) => {
    const rel = releases.find((r) => r.id === releaseId);
    return rel ? { name: rel.name, number: rel.release_number, date: rel.release_date } : null;
  };

  const getReleaseStatus = (releaseId: number) => {
    const today = new Date().toISOString().split("T")[0];
    const phases = masterplan
      .filter((phase) => phase.release_id === releaseId)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    if (phases.length === 0) return "Nessuna pianificazione";

    const firstPhaseStart = phases[0].start_date;
    const lastPhaseEnd = phases[phases.length - 1].end_date;

    if (today < firstPhaseStart) return "Pianificato";
    if (today > lastPhaseEnd) return "Completato";

    const activePhase = phases.find((phase) => today >= phase.start_date && today <= phase.end_date);
    if (activePhase) return activePhase.phase_name;

    const nextPhase = phases.find((phase) => today < phase.start_date);
    return nextPhase ? `Tra ${nextPhase.phase_name}` : "In corso";
  };

  const renderStatusBadge = (status: string) => {
    const lower = status.toLowerCase();
    let classes = "bg-slate-100 text-slate-700";
    if (lower.includes("complet")) classes = "bg-emerald-100 text-emerald-700";
    else if (lower.includes("pianific")) classes = "bg-slate-100 text-slate-700";
    else if (lower.includes("qa") || lower.includes("sviluppo") || lower.includes("freeze") || lower.includes("uat") || lower.includes("rilascio")) {
      classes = "bg-blue-100 text-blue-700";
    } else if (lower.includes("tra")) {
      classes = "bg-yellow-100 text-yellow-800";
    } else {
      classes = "bg-indigo-100 text-indigo-700";
    }

    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${classes}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestione Progetti</h1>
          <p className="text-gray-500 text-sm">Lista dei progetti, assegnazione alle Release e effort stimato</p>
        </div>
        <button
          onClick={() => openFormModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow"
        >
          + Nuovo Progetto
        </button>
      </div>

      {loading ? (
        <p className="text-center py-10 text-gray-500">Caricamento progetti in corso...</p>
      ) : progetti.length === 0 ? (
        <p className="text-center py-10 text-gray-500 bg-white border rounded-xl">Nessun progetto inserito al momento.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="min-w-[1100px] divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Nome Progetto</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Release Madre</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Stato</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Dev Effort (h)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Bugfix Effort (h)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">TL Effort (h)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Dev Remaining (h)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Bugfix Remaining (h)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">TL Remaining (h)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {progetti.map((p) => {
                const releaseInfo = getReleaseInfo(p.release_id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{p.name}</td>
                    
                    {/* Mostriamo i dati della Release incrociando l'ID */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {releaseInfo ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-indigo-700">{releaseInfo.name} ({releaseInfo.number})</span>
                          <span className="text-xs text-gray-500">{formattaData(releaseInfo.date)}</span>
                        </div>
                      ) : (
                        <span className="text-amber-500 text-xs italic">Nessuna Release</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {renderStatusBadge(getReleaseStatus(p.release_id))}
                    </td>

                    {(() => {
                      const devHours = p.dev_effort_h ?? (p.dev_effort ? p.dev_effort * 8 : 0);
                      const bugHours = p.bugfix_effort_h ?? (p.bugfix_effort ? p.bugfix_effort * 8 : 0);
                      const tlHours = p.tl_effort_h ?? (p.tl_effort ? p.tl_effort * 8 : 0);
                      const devRem = p.dev_remaining_h ?? devHours;
                      const bugRem = p.bugfix_remaining_h ?? bugHours;
                      const tlRem = p.tl_remaining_h ?? tlHours;
                      return (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoursValue(devHours)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoursValue(bugHours)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoursValue(tlHours)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoursValue(devRem)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoursValue(bugRem)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoursValue(tlRem)}</td>
                        </>
                      );
                    })()}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right space-x-3">
                      <button onClick={() => openFormModal(p)} className="text-amber-600 hover:text-amber-700 transition-colors">Modifica</button>
                      <button onClick={() => openDeleteModal(p)} className="text-red-600 hover:text-red-700 transition-colors">Elimina</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- POPUP INSERIMENTO / MODIFICA --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 m-4 relative border">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {currentProgetto ? "Modifica Progetto" : "Nuovo Progetto"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nome Progetto / Task</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Es. Sviluppo nuovo carrello"
                />
              </div>
              
              {/* ECCO LA TENDINA DELLE RELEASE */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Release di appartenenza</label>
                <select
                  required
                  value={formData.release_id}
                  onChange={(e) => setFormData({ ...formData, release_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="" disabled>Seleziona una release dal masterplan...</option>
                  {releases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.release_number}) - Rilascio: {formattaData(r.release_date)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Dev Effort (h)</label>
                  <input
                    type="number" step="0.25" min="0" required
                    value={formData.dev_effort_h}
                    onChange={(e) => setFormData({ ...formData, dev_effort_h: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Bugfix Effort (h)</label>
                  <input
                    type="number" step="0.25" min="0" required
                    value={formData.bugfix_effort_h}
                    onChange={(e) => setFormData({ ...formData, bugfix_effort_h: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">TL Effort (h)</label>
                  <input
                    type="number" step="0.25" min="0" required
                    value={formData.tl_effort_h}
                    onChange={(e) => setFormData({ ...formData, tl_effort_h: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Dev Remaining (h)</label>
                  <input
                    type="number" step="0.25" min="0" required
                    value={formData.dev_remaining_h}
                    onChange={(e) => setFormData({ ...formData, dev_remaining_h: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Bugfix Remaining (h)</label>
                  <input
                    type="number" step="0.25" min="0" required
                    value={formData.bugfix_remaining_h}
                    onChange={(e) => setFormData({ ...formData, bugfix_remaining_h: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">TL Remaining (h)</label>
                  <input
                    type="number" step="0.25" min="0" required
                    value={formData.tl_remaining_h}
                    onChange={(e) => setFormData({ ...formData, tl_remaining_h: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">Salva Progetto</button>
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
              Sei sicuro di voler eliminare il progetto <span className="font-semibold">{currentProgetto?.name}</span>? Questa azione è irreversibile.
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
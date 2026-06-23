"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Progetto {
  id: number;
  name: string;
  release_id?: number;
  developer_id?: number;
  developer_ids?: number[];
  bugfix_developer_ids?: number[];
  team_leading_developer_ids?: number[];
  tl_effort_h?: number;
  tl_effort?: number;
  tl_remaining_h?: number;
}

interface Release {
  id: number;
  name: string;
  release_number: string;
  release_date: string;
}

interface Persona {
  id: number;
  name: string;
  role: number;
  group: string;
}

interface MasterplanPhase {
  id: number;
  release_id: number;
  phase_name: string;
  start_date: string;
  end_date: string;
}

export default function TeamLeading() {
  const [progetti, setProgetti] = useState<Progetto[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [masterplan, setMasterplan] = useState<MasterplanPhase[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [currentAssignProject, setCurrentAssignProject] = useState<Progetto | null>(null);
  const [assignForm, setAssignForm] = useState({ developer_ids: [] as string[] });
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [currentLogProject, setCurrentLogProject] = useState<Progetto | null>(null);
  const [logForm, setLogForm] = useState({ hours: "", note: "" });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: releasesData, error: releaseError } = await supabase
        .from("Release")
        .select("*")
        .order("release_date", { ascending: true });

      if (releaseError) console.error("Errore release:", releaseError);
      else setReleases(releasesData || []);

      const { data: masterplanData, error: masterplanError } = await supabase
        .from("Masterplan")
        .select("*");

      if (masterplanError) console.error("Errore masterplan:", masterplanError);
      else setMasterplan(masterplanData || []);

      const { data: personeData, error: personeError } = await supabase
        .from("Persone")
        .select("*")
        .order("name", { ascending: true });

      if (personeError) console.error("Errore persone:", personeError);
      else setPersone(personeData || []);

      const { data: progettiData, error: progettiError } = await supabase
        .from("Project")
        .select("*")
        .order("id", { ascending: true });

      if (progettiError) console.error("Errore progetti:", progettiError);
      else setProgetti(progettiData || []);

      setLoading(false);
    };

    fetchData();
  }, []);

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

  const calculateWorkingDaysUntil = (endDateString?: string) => {
    if (!endDateString) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(`${endDateString}T00:00:00`);
    if (endDate < today) return 0;

    let days = 0;
    const cursor = new Date(today);
    while (cursor <= endDate) {
      const dayOfWeek = cursor.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  };

  const getReleaseInfo = (releaseId?: number) => {
    if (releaseId === undefined || releaseId === null) return null;
    const rel = releases.find((r) => r.id === releaseId);
    return rel ? { name: rel.name, number: rel.release_number, date: rel.release_date } : null;
  };

  const getReleaseStatus = (releaseId?: number) => {
    if (releaseId === undefined || releaseId === null) return { label: "Nessuna Release" };
    const today = new Date().toISOString().split("T")[0];
    const phases = masterplan
      .filter((phase) => phase.release_id === releaseId)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    if (phases.length === 0) return { label: "Nessuna pianificazione" };

    const firstPhaseStart = phases[0].start_date;
    const lastPhaseEnd = phases[phases.length - 1].end_date;

    if (today < firstPhaseStart) {
      return {
        label: "Pianificato",
        endDate: formattaData(phases[0].end_date),
        rawEndDate: phases[0].end_date,
      };
    }
    if (today > lastPhaseEnd) {
      return {
        label: "Completato",
        endDate: formattaData(lastPhaseEnd),
        rawEndDate: lastPhaseEnd,
      };
    }

    const activePhase = phases.find((phase) => today >= phase.start_date && today <= phase.end_date);
    if (activePhase) {
      return {
        label: activePhase.phase_name,
        endDate: formattaData(activePhase.end_date),
        rawEndDate: activePhase.end_date,
      };
    }

    const nextPhase = phases.find((phase) => today < phase.start_date);
    return nextPhase
      ? {
          label: `Tra ${nextPhase.phase_name}`,
          endDate: formattaData(nextPhase.end_date),
          rawEndDate: nextPhase.end_date,
        }
      : { label: "In corso" };
  };

  const getAssignedTeamLeads = (project: Progetto) => {
    const ids = project.team_leading_developer_ids?.length ? project.team_leading_developer_ids : [];
    return persone.filter((person) => ids.includes(person.id));
  };

  const openAssignModal = (project: Progetto) => {
    setCurrentAssignProject(project);
    const ids = project.team_leading_developer_ids?.length ? project.team_leading_developer_ids : [];
    setAssignForm({ developer_ids: ids.map(String) });
    setIsAssignOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAssignProject) return;

    const developerIds = assignForm.developer_ids.map(Number);
    const { error } = await supabase
      .from("Project")
      .update({ team_leading_developer_ids: developerIds })
      .eq("id", currentAssignProject.id);

    if (error) {
      alert("Errore durante l'assegnazione: " + error.message);
      return;
    }

    setIsAssignOpen(false);
    setCurrentAssignProject(null);
    setAssignForm({ developer_ids: [] });
    const { data: progettiData, error: progettiError } = await supabase
      .from("Project")
      .select("*")
      .order("id", { ascending: true });
    if (progettiError) console.error("Errore progetti:", progettiError);
    else setProgetti(progettiData || []);
  };

  const openLogModal = (project: Progetto) => {
    setCurrentLogProject(project);
    setLogForm({ hours: "", note: "" });
    setIsLogOpen(true);
  };

  const handleLogSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLogProject) return;

    const hours = Number(logForm.hours);
    if (!hours || hours < 0) {
      alert("Inserisci un valore ore valido");
      return;
    }

    const initialEffort = currentLogProject.tl_effort_h ?? (currentLogProject.tl_effort ? currentLogProject.tl_effort * 8 : 0);
    const newRemaining = initialEffort - hours;

    if (newRemaining < 0) {
      alert("Non puoi registrare ore che superano il TL effort iniziale.");
      return;
    }

    const { error: updateErr } = await supabase
      .from("Project")
      .update({ tl_remaining_h: newRemaining })
      .eq("id", currentLogProject.id);

    if (updateErr) {
      alert("Errore aggiornamento remaining: " + updateErr.message);
      return;
    }

    const { error: insertErr } = await supabase
      .from("TimeLogs")
      .insert([{ person_id: null, project_id: currentLogProject.id, type: "TeamLeading", hours, note: logForm.note }]);

    if (insertErr) {
      await supabase
        .from("Project")
        .update({ tl_remaining_h: currentLogProject.tl_remaining_h ?? initialEffort })
        .eq("id", currentLogProject.id);
      alert("Errore registrazione log: " + insertErr.message);
      return;
    }

    setIsLogOpen(false);
    setCurrentLogProject(null);
    setLogForm({ hours: "", note: "" });
    const { data: progettiData, error: progettiError } = await supabase
      .from("Project")
      .select("*")
      .order("id", { ascending: true });
    if (progettiError) console.error("Errore progetti:", progettiError);
    else setProgetti(progettiData || []);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Copertura Team Leading</h1>
          <p className="text-gray-500 text-sm">Tabella dei progetti Team Leading con release madre, stato e effort.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-10 text-gray-500">Caricamento in corso...</p>
      ) : progetti.length === 0 ? (
        <p className="text-center py-10 text-gray-500 bg-white border rounded-xl">Nessun progetto trovato.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="min-w-[900px] divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Nome Progetto</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Release Madre</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Stato</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Giorni lavorativi</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Team Lead assegnati</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Team Leading Effort (h)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Team Leading Remaining (h)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {progetti.map((progetto) => {
                const releaseInfo = getReleaseInfo(progetto.release_id);
                const effort = progetto.tl_effort_h ?? (progetto.tl_effort ? progetto.tl_effort * 8 : 0);
                const remaining = progetto.tl_remaining_h ?? effort;

                return (
                  <tr key={progetto.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{progetto.name}</td>
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
                      {(() => {
                        const status = getReleaseStatus(progetto.release_id);
                        return (
                          <div className="inline-flex flex-col rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            <span>{status.label}</span>
                            {status.endDate && <span className="text-[10px] font-normal text-blue-900">{status.endDate}</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {(() => {
                        const status = getReleaseStatus(progetto.release_id);
                        const days = calculateWorkingDaysUntil(status.rawEndDate);
                        return days === null ? "-" : `${days} gg`;
                      })()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {getAssignedTeamLeads(progetto).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {getAssignedTeamLeads(progetto).map((person) => (
                            <span key={person.id} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs">
                              {person.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-500 text-xs italic">Nessun team lead assegnato</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoursValue(effort)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoursValue(remaining)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-4">
                      <button
                        type="button"
                        onClick={() => openLogModal(progetto)}
                        className="text-emerald-600 hover:text-emerald-700 font-semibold"
                      >
                        Registra ore
                      </button>
                      <button
                        type="button"
                        onClick={() => openAssignModal(progetto)}
                        className="text-indigo-600 hover:text-indigo-700 font-semibold"
                      >
                        Assegna Team Lead
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAssignOpen && currentAssignProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-4 relative border">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Assegna Team Lead a {currentAssignProject.name}</h2>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Team Lead</label>
                <select
                  multiple
                  value={assignForm.developer_ids}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                    setAssignForm({ ...assignForm, developer_ids: selected });
                  }}
                  className="w-full h-44 border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {persone.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsAssignOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">Assegna</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLogOpen && currentLogProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-4 relative border">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Registra ore Team Leading per {currentLogProject.name}</h2>
            <form onSubmit={handleLogSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Ore loggate</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  required
                  value={logForm.hours}
                  onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  placeholder="Inserisci ore"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Note (opzionale)</label>
                <textarea
                  value={logForm.note}
                  onChange={(e) => setLogForm({ ...logForm, note: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  rows={3}
                  placeholder="Descrivi il lavoro svolto"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsLogOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">Registra</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

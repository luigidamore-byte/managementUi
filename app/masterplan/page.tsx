"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// 1. Interfacce aggiornate al nuovo schema del DB
interface Release {
  id: number;
  name: string;
  release_number: string;
  release_date: string;
}

interface MasterplanPhase {
  id: number;
  phase_name: string;
  start_date: string;
  end_date: string;
  release_id: number; // Ora punta alla Release, non più al Progetto
}

const PREDEFINED_PHASES = [
  "Analisi Funzionale",
  "Analisi Tecnica",
  "Sviluppo",
  "QA Warm up",
  "QA",
  "UAT",
  "Freeze",
  "Rilascio"
];

const getEmptyPhases = () => {
  const empty: Record<string, { start_date: string; end_date: string }> = {};
  PREDEFINED_PHASES.forEach(phase => {
    empty[phase] = { start_date: "", end_date: "" };
  });
  return empty;
};

export default function MasterplanPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [masterplan, setMasterplan] = useState<MasterplanPhase[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATI PER LA GESTIONE FASI (MODIFICA) ---
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [currentRelease, setCurrentRelease] = useState<Release | null>(null);
  const [editPhases, setEditPhases] = useState<Record<string, { start_date: string; end_date: string }>>({});

  // --- STATI PER LA NUOVA RELEASE (ALL IN ONE) ---
  const [isReleaseFormOpen, setIsReleaseFormOpen] = useState(false);
  const [releaseFormData, setReleaseFormData] = useState({ name: "", release_number: "", release_date: "" });
  const [releaseFormPhases, setReleaseFormPhases] = useState(getEmptyPhases());

  const today = new Date().toISOString().split("T")[0];

  const fetchData = async () => {
    setLoading(true);
    
    // Ora scarichiamo dalla nuova tabella "Release"
    const { data: releasesData, error: errRel } = await supabase
      .from("Release")
      .select("*")
      .order("release_date", { ascending: true });

    if (errRel) console.error("Errore release:", errRel);
    else setReleases(releasesData || []);

    const { data: phasesData, error: errPhases } = await supabase
      .from("Masterplan")
      .select("*");

    if (errPhases) console.error("Errore fasi:", errPhases);
    else setMasterplan(phasesData || []);

    setLoading(false);
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchData();
    };
    loadData();
  }, []);

  // --- CREA NUOVA RELEASE + FASI IN UN COLPO SOLO ---
  const handleSaveNewRelease = async (e: React.FormEvent) => {
    e.preventDefault();

    const releasePayload = {
      name: releaseFormData.name,
      release_number: releaseFormData.release_number,
      release_date: releaseFormData.release_date,
    };

    // Salviamo la Release e recuperiamo l'ID
    const { data: newReleaseData, error: releaseError } = await supabase
      .from("Release")
      .insert([releasePayload])
      .select();

    if (releaseError || !newReleaseData) {
      return alert("Errore durante la creazione della release: " + releaseError?.message);
    }

    const newReleaseId = newReleaseData[0].id;

    // Prepariamo le fasi associate al nuovo release_id
    const phasesPayload = Object.entries(releaseFormPhases)
      .filter(([, dates]) => dates.start_date !== "" && dates.end_date !== "")
      .map(([phaseName, dates]) => ({
        release_id: newReleaseId,
        phase_name: phaseName,
        start_date: dates.start_date,
        end_date: dates.end_date,
      }));

    if (phasesPayload.length > 0) {
      const { error: phasesError } = await supabase.from("Masterplan").insert(phasesPayload);
      if (phasesError) alert("Release creata, ma errore nel salvare le fasi: " + phasesError.message);
    }

    setIsReleaseFormOpen(false);
    setReleaseFormData({ name: "", release_number: "", release_date: "" });
    setReleaseFormPhases(getEmptyPhases());
    fetchData();
  };

  // --- MODIFICA FASI ESISTENTI ---
  const openEditPhaseForm = (release: Release) => {
    setCurrentRelease(release);
    
    const existingPhases = masterplan.filter((p) => p.release_id === release.id);
    const newFormState = getEmptyPhases();

    existingPhases.forEach((phase) => {
      if (newFormState[phase.phase_name]) {
        newFormState[phase.phase_name] = { start_date: phase.start_date, end_date: phase.end_date };
      }
    });

    setEditPhases(newFormState);
    setIsEditFormOpen(true);
  };

  const handleUpdatePhases = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRelease) return;

    const payload = Object.entries(editPhases)
      .filter(([, dates]) => dates.start_date !== "" && dates.end_date !== "")
      .map(([phaseName, dates]) => ({
        release_id: currentRelease.id,
        phase_name: phaseName,
        start_date: dates.start_date,
        end_date: dates.end_date,
      }));

    // Sostituzione massiva delle fasi per questa release
    const { error: deleteError } = await supabase.from("Masterplan").delete().eq("release_id", currentRelease.id);
    if (deleteError) return alert("Errore pulizia vecchie fasi: " + deleteError.message);

    if (payload.length > 0) {
      const { error: insertError } = await supabase.from("Masterplan").insert(payload);
      if (insertError) return alert("Errore aggiornamento fasi: " + insertError.message);
    }

    setIsEditFormOpen(false);
    fetchData();
  };

  const pad = (value: number) => String(value).padStart(2, "0");

  const formatDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const parseDate = (dateString: string) => new Date(`${dateString}T00:00:00`);

  const calculateEasterSunday = (year: number) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  };

  const getItalianHolidays = (year: number) => {
    const easter = calculateEasterSunday(year);
    const pasquetta = new Date(easter);
    pasquetta.setDate(easter.getDate() + 1);

    return {
      [`${year}-01-01`]: "Capodanno",
      [`${year}-01-06`]: "Epifania",
      [`${year}-04-25`]: "Festa della Liberazione",
      [`${year}-05-01`]: "Festa dei Lavoratori",
      [`${year}-06-02`]: "Festa della Repubblica",
      [`${year}-08-15`]: "Ferragosto",
      [`${year}-11-01`]: "Ognissanti",
      [`${year}-12-08`]: "Immacolata Concezione",
      [`${year}-12-25`]: "Natale",
      [`${year}-12-26`]: "Santo Stefano",
      [formatDateKey(easter)]: "Pasqua",
      [formatDateKey(pasquetta)]: "Lunedì dell'Angelo",
    } as Record<string, string>;
  };

  const isHoliday = (date: Date) => {
    return Boolean(getItalianHolidays(date.getFullYear())[formatDateKey(date)]);
  };

  const countWorkdays = (startDate: Date, endDate: Date) => {
    if (startDate > endDate) return 0;
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(current)) {
        count += 1;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const getRemainingWorkdays = (phase: MasterplanPhase) => {
    const todayDate = parseDate(today);
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const phaseEnd = parseDate(phase.end_date);
    return countWorkdays(tomorrow, phaseEnd);
  };

  const formattaData = (dataString: string) => {
    if (!dataString) return "";
    const [year, month, day] = dataString.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Masterplan Release</h1>
          <p className="text-gray-500 text-sm">Contenitori di progetto e fasi temporali. Oggi è il <span className="font-bold text-indigo-600">{formattaData(today)}</span></p>
        </div>
        <button
          onClick={() => {
            setReleaseFormPhases(getEmptyPhases());
            setIsReleaseFormOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow"
        >
          + Nuova Release
        </button>
      </div>

      {loading ? (
        <p className="text-center py-10 text-gray-500">Caricamento masterplan in corso...</p>
      ) : releases.length === 0 ? (
        <p className="text-center py-10 text-gray-500 bg-white border rounded-xl">Nessuna release trovata. Creane una usando il pulsante in alto.</p>
      ) : (
        <div className="space-y-4">
          {releases.map((release) => {
            const releasePhases = masterplan
              .filter((p) => p.release_id === release.id)
              .sort((a, b) => a.start_date.localeCompare(b.start_date));

            return (
              <div key={release.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {release.name} 
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">{release.release_number || "Draft"}</span>
                    </h2>
                    <p className="text-sm text-gray-500">Data Rilascio Finale: {formattaData(release.release_date) || "Da definire"}</p>
                  </div>
                  <button
                    onClick={() => openEditPhaseForm(release)}
                    className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Gestisci Fasi
                  </button>
                </div>

                {releasePhases.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
                    ⚠️ Nessuna fase inserita.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {releasePhases.map((phase) => {
                      const isCurrentPhase = today >= phase.start_date && today <= phase.end_date;
                      const isPastPhase = today > phase.end_date;

                      return (
                        <div 
                          key={phase.id} 
                          className={`flex flex-col p-2 rounded border text-sm ${
                            isCurrentPhase 
                              ? "bg-green-100 border-green-400 text-green-900 shadow-sm ring-1 ring-green-400"
                              : isPastPhase 
                                ? "bg-gray-50 border-gray-200 text-gray-400 opacity-70"
                                : "bg-blue-50 border-blue-200 text-blue-800"
                          }`}
                        >
                          <span className="font-semibold">{phase.phase_name}</span>
                          <span className="text-xs mt-1">
                            {formattaData(phase.start_date)} - {formattaData(phase.end_date)}
                          </span>
                          {isCurrentPhase && (
                            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/80 border border-green-300 px-2 py-1 text-[11px] font-semibold text-green-900">
                              {getRemainingWorkdays(phase)} giorni lavorativi rimanenti
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- POPUP 1: CREA NUOVA RELEASE + FASI --- */}
      {isReleaseFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fadeIn overflow-y-auto py-10">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 m-4 relative border">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Crea Nuova Release e Pianifica Fasi</h2>
            <form onSubmit={handleSaveNewRelease} className="space-y-6">
              
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">1. Dettagli Release</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Release</label>
                    <input type="text" required value={releaseFormData.name} onChange={(e) => setReleaseFormData({ ...releaseFormData, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" placeholder="Es. Major Update" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Versione / Numero</label>
                    <input type="text" required value={releaseFormData.release_number} onChange={(e) => setReleaseFormData({ ...releaseFormData, release_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" placeholder="Es. v1.2.0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Data Rilascio Finale</label>
                    <input type="date" required value={releaseFormData.release_date} onChange={(e) => setReleaseFormData({ ...releaseFormData, release_date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">2. Pianificazione Fasi (Opzionale)</h3>
                <div className="grid grid-cols-12 gap-4 pb-2 border-b text-xs font-semibold text-gray-500 uppercase">
                  <div className="col-span-4">Nome Fase</div>
                  <div className="col-span-4">Data Inizio</div>
                  <div className="col-span-4">Data Fine</div>
                </div>
                <div className="max-h-60 overflow-y-auto pr-2 mt-2 space-y-3">
                  {PREDEFINED_PHASES.map((phaseName) => (
                    <div key={phaseName} className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4 text-sm font-medium text-gray-700">{phaseName}</div>
                      <div className="col-span-4">
                        <input type="date" value={releaseFormPhases[phaseName].start_date} onChange={(e) => setReleaseFormPhases({ ...releaseFormPhases, [phaseName]: { ...releaseFormPhases[phaseName], start_date: e.target.value } })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="col-span-4">
                        <input type="date" value={releaseFormPhases[phaseName].end_date} onChange={(e) => setReleaseFormPhases({ ...releaseFormPhases, [phaseName]: { ...releaseFormPhases[phaseName], end_date: e.target.value } })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setIsReleaseFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">Salva Tutto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP 2: MODIFICA FASI ESISTENTI --- */}
      {isEditFormOpen && currentRelease && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn overflow-y-auto py-10">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 m-4 relative border">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Aggiorna Fasi: {currentRelease.name}</h2>
            <form onSubmit={handleUpdatePhases} className="space-y-4">
              <div className="grid grid-cols-12 gap-4 pb-2 border-b text-xs font-semibold text-gray-500 uppercase">
                <div className="col-span-4">Nome Fase</div>
                <div className="col-span-4">Data Inizio</div>
                <div className="col-span-4">Data Fine</div>
              </div>
              <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                {PREDEFINED_PHASES.map((phaseName) => (
                  <div key={phaseName} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4 text-sm font-medium text-gray-700">{phaseName}</div>
                    <div className="col-span-4">
                      <input type="date" value={editPhases[phaseName].start_date} onChange={(e) => setEditPhases({ ...editPhases, [phaseName]: { ...editPhases[phaseName], start_date: e.target.value } })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="col-span-4">
                      <input type="date" value={editPhases[phaseName].end_date} onChange={(e) => setEditPhases({ ...editPhases, [phaseName]: { ...editPhases[phaseName], end_date: e.target.value } })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-3 pt-6 mt-4 border-t">
                <button type="button" onClick={() => setIsEditFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">Aggiorna Fasi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
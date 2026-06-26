"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// 1. Interfacce aggiornate al nuovo schema del DB
interface Release {
  id: number;
  name: string;
  release_number: string;
  release_date: string;
  year?: number;
}

interface MasterplanPhase {
  id: number;
  phase_name: string;
  start_date: string;
  end_date: string;
  release_id: number; // Ora punta alla Release, non più al Progetto
}

interface Project {
  id: number;
  name: string;
  release_id?: number;
  dev_effort_h?: number;
  dev_effort?: number;
  bugfix_effort_h?: number;
}

interface PhaseProject {
  id: number;
  name: string;
  type: 'Sviluppo' | 'Bugfix';
  initialEffort: number;
  loggedHours: number;
  remainingHours: number;
}

interface DeveloperAvailability {
  id: number;
  name: string;
  availableHours: number;
}

interface TimeLog {
  project_id: number;
  type: string;
  hours: number;
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
  const { user } = useAuth();
  const isAdmin = user?.position === 'Administrator';

  const [releases, setReleases] = useState<Release[]>([]);
  const [masterplan, setMasterplan] = useState<MasterplanPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPhaseProjectsOpen, setIsPhaseProjectsOpen] = useState(false);
  const [phasePopupRelease, setPhasePopupRelease] = useState<Release | null>(null);
  const [phasePopupPhase, setPhasePopupPhase] = useState<MasterplanPhase | null>(null);
  const [phasePopupProjects, setPhasePopupProjects] = useState<PhaseProject[]>([]);
  const [developerAvailability, setDeveloperAvailability] = useState<DeveloperAvailability[]>([]);
  const [phasePopupLoading, setPhasePopupLoading] = useState(false);
  const [phasePopupTotalInitial, setPhasePopupTotalInitial] = useState(0);
  const [phasePopupTotalLogged, setPhasePopupTotalLogged] = useState(0);
  const [phasePopupTotalRemaining, setPhasePopupTotalRemaining] = useState(0);
  const [phasePopupTotalInitialBugfix, setPhasePopupTotalInitialBugfix] = useState(0);
  const [phasePopupTotalLoggedBugfix, setPhasePopupTotalLoggedBugfix] = useState(0);
  const [phasePopupTotalRemainingBugfix, setPhasePopupTotalRemainingBugfix] = useState(0);

  // --- STATI PER LA GESTIONE FASI (MODIFICA) ---
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [currentRelease, setCurrentRelease] = useState<Release | null>(null);
  const [editPhases, setEditPhases] = useState<Record<string, { start_date: string; end_date: string }>>({});

  // --- STATI PER LA NUOVA RELEASE (ALL IN ONE) ---
  const [isReleaseFormOpen, setIsReleaseFormOpen] = useState(false);
  const [releaseFormData, setReleaseFormData] = useState({ name: "", release_number: "", release_date: "", year: new Date().getFullYear() });
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
      year: releaseFormData.year,
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
    setReleaseFormData({ name: "", release_number: "", release_date: "", year: new Date().getFullYear() });
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

  const handleOpenPhaseProjectsPopup = async (release: Release, phase: MasterplanPhase) => {
    setPhasePopupRelease(release);
    setPhasePopupPhase(phase);
    setIsPhaseProjectsOpen(true);
    setPhasePopupLoading(true);

    // Reset states
    setPhasePopupProjects([]);
    setDeveloperAvailability([]);
    setPhasePopupTotalInitial(0);
    setPhasePopupTotalLogged(0);
    setPhasePopupTotalRemaining(0);
    setPhasePopupTotalInitialBugfix(0);
    setPhasePopupTotalLoggedBugfix(0);
    setPhasePopupTotalRemainingBugfix(0);

    // --- Developer Availability Calculation ---
    const todayDate = parseDate(today);
    const phaseStartDate = parseDate(phase.start_date);
    const phaseEndDate = parseDate(phase.end_date);

    // Calculation starts from today or the phase start date if it's in the future.
    const calculationStartDate = new Date(Math.max(todayDate.getTime(), phaseStartDate.getTime()));

    // 1. Fetch all people and roles
    const { data: personeData, error: personeError } = await supabase.from("Persone").select("id, name, role");
    if (personeError) console.error("Error fetching people:", personeError);
    
    const { data: ruoliData, error: ruoliError } = await supabase.from("Ruoli").select("id, nome");
    if (ruoliError) console.error("Error fetching roles:", ruoliError);

    const roleMap = new Map(ruoliData?.map(r => [r.id, r.nome]));

    // Filter developers to only include those with the role "Developer"
    const developers = (personeData || []).filter(p => roleMap.get(p.role) === "Developer");

    const { data: absencesData, error: absencesError } = await supabase
      .from("Absences")
      .select("person_id, type, start_date, end_date, hours")
      .lte("start_date", phase.end_date)
      .gte("end_date", phase.start_date);
    if (absencesError) console.error("Error fetching absences:", absencesError);
    const absences = absencesData || [];
    
    // 2. Separate company closures from personal absences
    const companyClosures = absences.filter(a => a.person_id === null);

    // 3. Calculate available hours for each developer from calculationStartDate to phaseEndDate
    const availability: DeveloperAvailability[] = developers.map(dev => {
        const remainingWorkDaysInPhase = countWorkdays(calculationStartDate, phaseEndDate, companyClosures);
        let availableHours = remainingWorkDaysInPhase * 8;

        const devAbsences = absences.filter(a => a.person_id === dev.id);

        devAbsences.forEach(absence => {
            if (absence.type === "Permesso" && absence.hours) {
                // Only subtract permissions if they are in the future
                const absenceDate = parseDate(absence.start_date); // Assuming permesso is for a single day
                if (absenceDate >= calculationStartDate) {
                    availableHours -= absence.hours;
                }
            } else if (["Ferie", "Malattia"].includes(absence.type)) {
                const absenceStart = parseDate(absence.start_date);
                const absenceEnd = parseDate(absence.end_date);
                
                // Find intersection of the remaining phase period and the absence
                const intersectionStart = new Date(Math.max(calculationStartDate.getTime(), absenceStart.getTime()));
                const intersectionEnd = new Date(Math.min(phaseEndDate.getTime(), absenceEnd.getTime()));

                const workdaysOff = countWorkdays(intersectionStart, intersectionEnd, companyClosures);
                availableHours -= workdaysOff * 8;
            }
        });

        return {
            id: dev.id,
            name: dev.name,
            availableHours: Math.max(0, availableHours) // Ensure it doesn't go below 0
        };
    });
    setDeveloperAvailability(availability);


    // --- Project Calculation (existing logic) ---
    let allProjectsForPopup: PhaseProject[] = [];

    // 1. Get projects for the CURRENT release (for DEV effort)
    const { data: projectsData, error: projectsError } = await supabase
      .from("Project")
      .select("id,name,release_id,dev_effort_h,dev_effort")
      .eq("release_id", release.id);

    if (projectsError) {
      console.error("Errore progetti fase:", projectsError);
      setPhasePopupLoading(false);
      return;
    }

    const currentProjectIds = (projectsData || []).map((p) => p.id);
    let devLogsData: TimeLog[] = [];
    if (currentProjectIds.length > 0) {
      const { data, error } = await supabase.from("TimeLogs").select("project_id,type,hours").in("project_id", currentProjectIds).eq("type", "Dev");
      if (error) console.error("Errore time logs DEV:", error);
      else devLogsData = data || [];
    }

    const devProjects = (projectsData || []).map((project): PhaseProject => {
      const initialEffort = project.dev_effort_h ?? (project.dev_effort ? project.dev_effort * 8 : 0);
      const loggedHours = devLogsData
        .filter((log) => log.project_id === project.id)
        .reduce((sum, log) => sum + (log.hours ?? 0), 0);
      const remainingHours = Math.max(initialEffort - loggedHours, 0);
      return {
        id: project.id,
        name: project.name,
        type: 'Sviluppo',
        initialEffort,
        loggedHours,
        remainingHours,
      };
    });
    allProjectsForPopup.push(...devProjects);

    // 2. Find the PREVIOUS release
    const currentVersion = parseInt(release.release_number, 10);
    const currentYear = release.year || new Date(release.release_date).getFullYear();
    let prevRelease = null;

    if (currentVersion > 1) {
      const prevVersion = currentVersion - 1;
      prevRelease = releases.find(r => parseInt(r.release_number, 10) === prevVersion && r.year === currentYear);
    } else { // version is 1
      const prevYear = currentYear - 1;
      prevRelease = releases.find(r => parseInt(r.release_number, 10) === 7 && r.year === prevYear);
    }

    // 3. Get projects and logs for the PREVIOUS release (for BUGFIX effort)
    if (prevRelease) {
      const { data: prevProjectsData, error: prevProjectsError } = await supabase
        .from("Project")
        .select("id,name,bugfix_effort_h")
        .eq("release_id", prevRelease.id);
      
      if (prevProjectsError) {
        console.error("Errore progetti release precedente:", prevProjectsError);
      } else {
        const prevProjectIds = (prevProjectsData || []).map((p) => p.id);
        let bugfixLogsData: TimeLog[] = [];
        if (prevProjectIds.length > 0) {
          const { data, error } = await supabase.from("TimeLogs").select("project_id,type,hours").in("project_id", prevProjectIds).eq("type", "Bugfix");
          if (error) console.error("Errore time logs BUGFIX:", error);
          else bugfixLogsData = data || [];
        }

        const bugfixProjects = (prevProjectsData || []).map((project): PhaseProject => {
          const initialEffort = project.bugfix_effort_h || 0;
          const loggedHours = bugfixLogsData
            .filter(log => log.project_id === project.id)
            .reduce((sum, log) => sum + (log.hours ?? 0), 0);
          const remainingHours = Math.max(initialEffort - loggedHours, 0);
          return {
            id: project.id,
            name: project.name,
            type: 'Bugfix',
            initialEffort,
            loggedHours,
            remainingHours,
          };
        });
        allProjectsForPopup.push(...bugfixProjects);
      }
    }
    
    // 4. Set state for projects and totals
    setPhasePopupProjects(allProjectsForPopup);

    let totalDevInitial = 0, totalDevLogged = 0, totalDevRemaining = 0;
    let totalBugfixInitial = 0, totalBugfixLogged = 0, totalBugfixRemaining = 0;

    allProjectsForPopup.forEach(p => {
      if (p.type === 'Sviluppo') {
        totalDevInitial += p.initialEffort;
        totalDevLogged += p.loggedHours;
        totalDevRemaining += p.remainingHours;
      } else {
        totalBugfixInitial += p.initialEffort;
        totalBugfixLogged += p.loggedHours;
        totalBugfixRemaining += p.remainingHours;
      }
    });

    setPhasePopupTotalInitial(totalDevInitial);
    setPhasePopupTotalLogged(totalDevLogged);
    setPhasePopupTotalRemaining(totalDevRemaining);
    setPhasePopupTotalInitialBugfix(totalBugfixInitial);
    setPhasePopupTotalLoggedBugfix(totalBugfixLogged);
    setPhasePopupTotalRemainingBugfix(totalBugfixRemaining);

    setPhasePopupLoading(false);
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

  const isHoliday = (date: Date, italianHolidays: Record<string, string>) => {
    return Boolean(italianHolidays[formatDateKey(date)]);
  };

  const countWorkdays = (startDate: Date, endDate: Date, companyClosures: { start_date: string, end_date: string }[]) => {
    if (startDate > endDate) return 0;
    let count = 0;
    const current = new Date(startDate);
    const italianHolidays = getItalianHolidays(current.getFullYear());
    // TODO: Handle multi-year holiday fetching if needed

    const isCompanyClosureDay = (date: Date) => {
        const dateKey = formatDateKey(date);
        return companyClosures.some(closure => dateKey >= closure.start_date && dateKey <= closure.end_date);
    };

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(current, italianHolidays) && !isCompanyClosureDay(current)) {
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
    return countWorkdays(tomorrow, phaseEnd, []); // Assuming no company closures for remaining workdays for now
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
          <h1 className="text-2xl font-bold text-gray-800">Masterplan: Panoramica Release</h1>
          <p className="text-gray-500 text-sm">Gestione e visualizzazione delle release e delle loro fasi. Oggi è il <span className="font-bold text-indigo-600">{formattaData(today)}</span></p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setReleaseFormPhases(getEmptyPhases());
              setIsReleaseFormOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow"
          >
            + Nuova Release
          </button>
        )}
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
                      {release.year && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">{release.year}</span>}
                    </h2>
                    <p className="text-sm text-gray-500">Data Rilascio Finale: {formattaData(release.release_date) || "Da definire"}</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => openEditPhaseForm(release)}
                      className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Gestisci Fasi
                    </button>
                  )}
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
                          role={phase.phase_name === "Sviluppo" ? "button" : undefined}
                          tabIndex={phase.phase_name === "Sviluppo" ? 0 : undefined}
                          onClick={phase.phase_name === "Sviluppo" ? () => handleOpenPhaseProjectsPopup(release, phase) : undefined}
                          className={`flex flex-col p-2 rounded border text-sm ${phase.phase_name === "Sviluppo" ? "cursor-pointer hover:ring-2 hover:ring-indigo-300" : ""} ${
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
                          {phase.phase_name === "Sviluppo" && (
                            <span className="mt-2 text-[11px] font-semibold text-indigo-700">Clicca per visualizzare i progetti</span>
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
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Release</label>
                    <input type="text" required value={releaseFormData.name} onChange={(e) => setReleaseFormData({ ...releaseFormData, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" placeholder="Es. Major Update" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Versione / Numero</label>
                    <input type="text" required value={releaseFormData.release_number} onChange={(e) => setReleaseFormData({ ...releaseFormData, release_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" placeholder="Es. v1.2.0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Anno</label>
                    <input type="number" required min="2020" max="2050" value={releaseFormData.year} onChange={(e) => setReleaseFormData({ ...releaseFormData, year: parseInt(e.target.value || String(new Date().getFullYear())) })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" placeholder="Es. 2026" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Data Rilascio Finale</label>
                    <input type="date" value={releaseFormData.release_date} onChange={(e) => setReleaseFormData({ ...releaseFormData, release_date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" />
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

      {isPhaseProjectsOpen && phasePopupRelease && phasePopupPhase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60 animate-fadeIn overflow-y-auto py-10">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 m-4 relative border">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Progetti release {phasePopupRelease.name}</h2>
                <p className="text-sm text-gray-500">Fase: {phasePopupPhase.phase_name} — Fine fase: {formattaData(phasePopupPhase.end_date)}</p>
                <p className="text-sm text-gray-500">Ore lavorative rimanenti fino alla fine della fase: {(getRemainingWorkdays(phasePopupPhase) * 8).toFixed(2)} h</p>
              </div>
              <button type="button" onClick={() => setIsPhaseProjectsOpen(false)} className="text-gray-500 hover:text-gray-900">Chiudi</button>
            </div>
            {phasePopupLoading ? (
              <p className="text-gray-500">Caricamento progetti...</p>
            ) : (
              <div className="space-y-4">
                {phasePopupProjects.length === 0 ? (
                  <p className="text-sm text-gray-500">Nessun progetto associato a questa release.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-gray-600">Progetto</th>
                          <th className="px-4 py-2 font-semibold text-gray-600">Tipo</th>
                          <th className="px-4 py-2 font-semibold text-gray-600">Ore iniziali</th>
                          <th className="px-4 py-2 font-semibold text-gray-600">Ore loggate</th>
                          <th className="px-4 py-2 font-semibold text-gray-600">Ore rimanenti</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {phasePopupProjects.map((project, index) => (
                          <tr key={`${project.id}-${index}`} className={`hover:bg-gray-50 ${project.type === 'Bugfix' ? 'bg-blue-50' : ''}`}>
                            <td className="px-4 py-3 text-gray-800">{project.name}</td>
                            <td className="px-4 py-3 text-gray-700">
                              <span className={`px-2 py-1 text-xs rounded-full ${project.type === 'Sviluppo' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                {project.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{project.initialEffort.toFixed(2)}</td>
                            <td className="px-4 py-3 text-gray-700">{project.loggedHours.toFixed(2)}</td>
                            <td className="px-4 py-3 text-gray-700 font-bold">{project.remainingHours.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                       <tfoot className="bg-gray-100 font-bold">
                        <tr className="border-t-2 border-gray-300">
                          <td className="px-4 py-3 text-gray-800" colSpan={2}>Totale Sviluppo</td>
                          <td className="px-4 py-3 text-gray-700">{phasePopupTotalInitial.toFixed(2)} h</td>
                          <td className="px-4 py-3 text-gray-700">{phasePopupTotalLogged.toFixed(2)} h</td>
                          <td className="px-4 py-3 text-gray-800">{phasePopupTotalRemaining.toFixed(2)} h</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-gray-800" colSpan={2}>Totale Bugfix</td>
                          <td className="px-4 py-3 text-gray-700">{phasePopupTotalInitialBugfix.toFixed(2)} h</td>
                          <td className="px-4 py-3 text-gray-700">{phasePopupTotalLoggedBugfix.toFixed(2)} h</td>
                          <td className="px-4 py-3 text-gray-800">{phasePopupTotalRemainingBugfix.toFixed(2)} h</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Developer Availability Table */}
                <div className="mt-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">Disponibilità Sviluppatori per la Fase</h3>
                    {developerAvailability.length === 0 ? (
                        <p className="text-sm text-gray-500">Nessun dato sulla disponibilità.</p>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 font-semibold text-gray-600">Sviluppatore</th>
                                        <th className="px-4 py-2 font-semibold text-gray-600">Ore Disponibili nella Fase</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {developerAvailability.map((dev) => (
                                        <tr key={dev.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-800">{dev.name}</td>
                                            <td className="px-4 py-3 text-gray-700 font-bold">{dev.availableHours.toFixed(2)} h</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold">
                                    <tr>
                                        <td className="px-4 py-3 text-gray-800">Totale Ore Disponibili</td>
                                        <td className="px-4 py-3 text-gray-800">
                                            {developerAvailability.reduce((acc, dev) => acc + dev.availableHours, 0).toFixed(2)} h
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
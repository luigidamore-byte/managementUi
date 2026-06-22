"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Persona {
  id: number;
  name: string;
  group: string;
}

interface Assenza {
  id: number;
  person_id: number | null;
  type: string;
  start_date: string;
  end_date: string;
  description: string;
  hours?: number | null;
}

const TIPOLOGIE_ASSENZA = ["Chiusura Aziendale", "Ferie", "Permesso", "Malattia", "Altro"];

export default function AssenzePage() {
  const [assenze, setAssenze] = useState<Assenza[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentAssenza, setCurrentAssenza] = useState<Assenza | null>(null);

  const [formData, setFormData] = useState({
    person_id: "",
    type: "Ferie", // Default
    start_date: "",
    end_date: "",
    description: "",
    hours: "",
  });
  const [groupFilter, setGroupFilter] = useState("");
  const [checkedPeople, setCheckedPeople] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const fetchData = async () => {
    setLoading(true);

    const { data: personeData, error: errPersone } = await supabase
      .from("Persone")
      .select("id, name, group")
      .order("name", { ascending: true });

    if (errPersone) console.error("Errore persone:", errPersone);
    else setPersone(personeData || []);

    const { data: assenzeData, error: errAssenze } = await supabase
      .from("Absences")
      .select("*")
      .order("start_date", { ascending: true });

    if (errAssenze) console.error("Errore assenze:", errAssenze);
    else setAssenze(assenzeData || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openFormModal = (assenza: Assenza | null = null, prefillDate: string = "") => {
    if (assenza) {
      setCurrentAssenza(assenza);
      setFormData({
        person_id: assenza.person_id ? assenza.person_id.toString() : "",
        type: assenza.type,
        start_date: assenza.start_date,
        end_date: assenza.end_date,
        description: assenza.description || "",
        hours: assenza.hours?.toString() || "",
      });
      setGroupFilter("");
      setCheckedPeople([]);
    } else {
      setCurrentAssenza(null);
      setFormData({
        person_id: "",
        type: "Ferie",
        start_date: prefillDate,
        end_date: "",
        description: "",
        hours: "",
      });
      setGroupFilter("");
      setCheckedPeople([]);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Se è una chiusura aziendale, person_id DEVE essere null
    const payload = {
      type: formData.type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      description: formData.description,
      hours: formData.type === "Permesso" ? Number(formData.hours) : null,
    };

    if (currentAssenza) {
      const personId = formData.type === "Chiusura Aziendale" || !formData.person_id ? null : Number(formData.person_id);
      const { error } = await supabase.from("Absences").update({ ...payload, person_id: personId }).eq("id", currentAssenza.id);
      if (error) alert("Errore durante l'aggiornamento: " + error.message);
    } else {
      if (formData.type === "Ferie" || formData.type === "Chiusura Aziendale") {
        if (groupFilter && checkedPeople.length === 0) {
          return alert("Seleziona almeno una persona dal gruppo oppure deseleziona il gruppo per applicare la chiusura a tutta l'azienda.");
        }

        const payloads = checkedPeople.length > 0
          ? checkedPeople.map((personId) => ({
              ...payload,
              person_id: Number(personId),
              type: formData.type,
            }))
          : [{ ...payload, person_id: null, type: formData.type }];

        const { error } = await supabase.from("Absences").insert(payloads);
        if (error) return alert("Errore durante l'inserimento: " + error.message);
      } else {
        const personId = !formData.person_id ? null : Number(formData.person_id);
        const { error } = await supabase.from("Absences").insert([{ ...payload, person_id: personId }]);
        if (error) alert("Errore durante l'inserimento: " + error.message);
      }
    }

    setIsFormOpen(false);
    fetchData();
  };

  const groups = Array.from(new Set(persone.map((p) => p.group).filter(Boolean))).sort();
  const peopleInGroup = persone.filter((p) => p.group === groupFilter);

  const openDeleteModal = (assenza: Assenza) => {
    setCurrentAssenza(assenza);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!currentAssenza) return;

    const { error } = await supabase.from("Absences").delete().eq("id", currentAssenza.id);

    if (error) {
      alert("Errore durante l'eliminazione: " + error.message);
    } else {
      setIsDeleteOpen(false);
      fetchData();
    }
  };

  const formattaData = (dataString: string) => {
    if (!dataString) return "-";
    const [year, month, day] = dataString.split("-");
    return `${day}/${month}/${year}`;
  };

  const getNomePersona = (personId: number | null) => {
    if (!personId) return <span className="font-bold text-indigo-600">TUTTA L'AZIENDA</span>;
    const persona = persone.find((p) => p.id === personId);
    return persona ? persona.name : "Sconosciuto";
  };

  const pad = (value: number) => value.toString().padStart(2, "0");

  const formatDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

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

  const getHolidayName = (date: Date) => {
    const year = date.getFullYear();
    return getItalianHolidays(year)[formatDateKey(date)] || "";
  };

  const removeAbsenceForDate = async (assenza: Assenza, dateKey: string) => {
    const confirmed = window.confirm(`Rimuovere l'assenza di ${getNomePersona(assenza.person_id)} per il giorno ${dateKey}?`);
    if (!confirmed) return;

    if (assenza.start_date === dateKey && assenza.end_date === dateKey) {
      const { error } = await supabase.from("Absences").delete().eq("id", assenza.id);
      if (error) return alert("Errore durante la cancellazione: " + error.message);
    } else if (dateKey === assenza.start_date) {
      const nextDate = new Date(dateKey);
      nextDate.setDate(nextDate.getDate() + 1);
      const { error } = await supabase
        .from("Absences")
        .update({ start_date: formatDateKey(nextDate) })
        .eq("id", assenza.id);
      if (error) return alert("Errore durante l'aggiornamento: " + error.message);
    } else if (dateKey === assenza.end_date) {
      const prevDate = new Date(dateKey);
      prevDate.setDate(prevDate.getDate() - 1);
      const { error } = await supabase
        .from("Absences")
        .update({ end_date: formatDateKey(prevDate) })
        .eq("id", assenza.id);
      if (error) return alert("Errore durante l'aggiornamento: " + error.message);
    } else {
      const prevDate = new Date(dateKey);
      prevDate.setDate(prevDate.getDate() - 1);
      const nextDate = new Date(dateKey);
      nextDate.setDate(nextDate.getDate() + 1);

      const firstSegment = {
        person_id: assenza.person_id,
        type: assenza.type,
        start_date: assenza.start_date,
        end_date: formatDateKey(prevDate),
        description: assenza.description,
        hours: assenza.hours,
      };

      const secondSegment = {
        person_id: assenza.person_id,
        type: assenza.type,
        start_date: formatDateKey(nextDate),
        end_date: assenza.end_date,
        description: assenza.description,
        hours: assenza.hours,
      };

      const { error: updateError } = await supabase
        .from("Absences")
        .update({ end_date: firstSegment.end_date })
        .eq("id", assenza.id);
      if (updateError) return alert("Errore durante l'aggiornamento: " + updateError.message);

      const { error: insertError } = await supabase.from("Absences").insert([secondSegment]);
      if (insertError) return alert("Errore durante l'inserimento del secondo segmento: " + insertError.message);
    }

    fetchData();
  };

  const monthLabel = currentMonth.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  const getCalendarGrid = () => {
    const days: Array<{ date: Date; label: number; absences: Assenza[] }> = [];
    const firstDayIndex = (startOfMonth.getDay() + 6) % 7;
    const current = new Date(startOfMonth);
    const totalDays = endOfMonth.getDate();

    for (let i = 0; i < firstDayIndex; i += 1) {
      days.push({ date: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), i - firstDayIndex + 1), label: 0, absences: [] });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateKey = formatDateKey(date);
      const dayAbsences = assenze.filter((a) => a.type === "Ferie" && dateKey >= a.start_date && dateKey <= a.end_date);
      days.push({ date, label: day, absences: dayAbsences });
    }

    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      days.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), label: 0, absences: [] });
    }

    return days;
  };

  const calendarDays = getCalendarGrid();
  const todayKey = formatDateKey(new Date());

  const changeMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + (direction === "next" ? 1 : -1), 1));
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ferie e Chiusure</h1>
          <p className="text-gray-500 text-sm">Gestione chiusure aziendali, ferie e permessi del personale</p>
        </div>
        {/* Pulsante rimosso: Aggiunta assenza ora tramite calendario o interfaccia specifica */}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500">Visualizzazione calendario delle ferie del mese.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth("prev")} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Prev</button>
            <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
            <button onClick={() => changeMonth("next")} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Next</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-500 uppercase">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
            <div key={day} className="py-2">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            const isWeekend = [0, 6].includes(day.date.getDay());
            const holidayName = day.label ? getHolidayName(day.date) : "";
            const isHoliday = Boolean(holidayName);
            const isToday = formatDateKey(day.date) === todayKey;
            const dayBaseClasses = day.label
              ? 'min-h-[100px] rounded-2xl border p-3 text-left shadow-sm cursor-pointer'
              : 'min-h-[100px] rounded-2xl border bg-gray-100 cursor-default p-3 text-left shadow-sm';
            const dayHighlightClasses = day.label
              ? isToday
                ? 'border-black bg-white hover:border-black'
                : isHoliday
                  ? 'border-red-300 bg-red-50 hover:border-red-400'
                  : isWeekend
                    ? 'border-red-200 bg-red-50/50 hover:border-red-300'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
              : 'border-gray-200 bg-gray-100';
            const dayClasses = `${dayBaseClasses} ${dayHighlightClasses}`;

            return (
              <div
                key={`${formatDateKey(day.date)}-${index}`}
                role={day.label ? 'button' : undefined}
                tabIndex={day.label ? 0 : undefined}
                onClick={() => day.label && openFormModal(null, formatDateKey(day.date))}
                className={dayClasses}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${day.label ? (isHoliday || isWeekend ? 'text-red-600' : 'text-gray-900') : 'text-gray-400'}`}>{day.label || ''}</span>
                </div>
                {holidayName ? (
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">{holidayName}</div>
                ) : null}
                {day.absences.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs">
                    {day.absences.slice(0, 3).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAbsenceForDate(a, formatDateKey(day.date));
                        }}
                        className="w-full text-left rounded-xl border border-green-100 bg-green-50 px-2 py-1 text-left text-green-800 hover:bg-green-100 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{getNomePersona(a.person_id)}</span>
                          <span className="text-[10px] font-semibold uppercase text-red-600">Rimuovi</span>
                        </div>
                      </button>
                    ))}
                    {day.absences.length > 3 && (
                      <div className="rounded-xl border border-green-100 bg-green-50 px-2 py-1 text-green-800">+{day.absences.length - 3} altri</div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-gray-400">Nessuna ferie</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- POPUP INSERIMENTO --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-4 relative border">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {currentAssenza ? "Modifica Assenza" : "Nuova Assenza / Chiusura"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              
                      <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Tipologia</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData({
                      ...formData,
                      type: newType,
                      person_id: newType === "Chiusura Aziendale" ? "" : formData.person_id,
                    });
                    if (newType === "Malattia" || newType === "Altro") {
                      setGroupFilter("");
                      setCheckedPeople([]);
                    }
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {TIPOLOGIE_ASSENZA.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              {/* Mostra il campo Gruppo + checkbox per Ferie e Chiusura Aziendale in creazione */}
              {((formData.type === "Ferie" || formData.type === "Chiusura Aziendale") && !currentAssenza) ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Gruppo</label>
                    <select
                      value={groupFilter}
                      onChange={(e) => {
                        setGroupFilter(e.target.value);
                        setCheckedPeople([]);
                      }}
                      className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="" disabled>Seleziona un gruppo...</option>
                      {groups.map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>

                  {groupFilter ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Seleziona le persone del gruppo per assegnare questa assenza.</p>
                      <div className="grid gap-2">
                        {peopleInGroup.length > 0 ? (
                          peopleInGroup.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-sm text-gray-900">
                              <input
                                type="checkbox"
                                checked={checkedPeople.includes(p.id.toString())}
                                onChange={(e) => {
                                  const idStr = p.id.toString();
                                  setCheckedPeople((current) =>
                                    e.target.checked
                                      ? [...current, idStr]
                                      : current.filter((value) => value !== idStr)
                                  );
                                }}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              {p.name}
                            </label>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">Nessuna persona disponibile in questo gruppo.</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {formData.type === "Chiusura Aziendale" ? (
                    <p className="text-sm text-gray-500">Se non selezioni persone, la chiusura verrà applicata a tutta l'azienda.</p>
                  ) : null}
                </>
              ) : formData.type !== "Chiusura Aziendale" ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Persona</label>
                  <select
                    required
                    value={formData.person_id}
                    onChange={(e) => setFormData({ ...formData, person_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="" disabled>Seleziona una persona...</option>
                    {persone.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Dal Giorno</label>
                  <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Al Giorno (incluso)</label>
                  <input type="date" required value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {formData.type === "Permesso" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Ore di assenza</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    required
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Es. 4"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Descrizione (Opzionale)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Es. Ferie estive, Natale, Visita medica..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">Salva</button>
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
            <p className="text-sm text-gray-600 mb-6">Sei sicuro di voler eliminare questa registrazione?</p>
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
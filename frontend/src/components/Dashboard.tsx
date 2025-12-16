import { useState, useEffect } from 'react';
import { Calendar, Users, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from './utils/Sidebar';
import eventService, { type Event } from '../services/eventService';
import { useAuth } from '../contexts/AuthContext';

interface DashboardProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

export default function Dashboard({ onNavigate, onLogout }: DashboardProps) {

  // Estado para la navegación del calendario
  const [calendarDate, setCalendarDate] = useState(new Date());
  // Nuevo: fecha seleccionada para "Eventos de Hoy"
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Estados para eventos
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Obtener información del día actual
  const today = new Date();

  // Nombres de meses en español
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Mostrar solo 4 semanas (28 celdas)
  const totalCells = 28;

  // Inicio de la semana (domingo) para la fecha seleccionada
  const startOfWeek = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0 = Domingo
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const gridStartDate = startOfWeek(calendarDate);

  // Navegación por bloques de 4 semanas
  const goToPreviousPeriod = () => {
    const prev = new Date(calendarDate);
    prev.setDate(prev.getDate() - 28);
    setCalendarDate(prev);
  };

  const goToNextPeriod = () => {
    const next = new Date(calendarDate);
    next.setDate(next.getDate() + 28);
    setCalendarDate(next);
  };

  const goToToday = () => {
    const now = new Date();
    setCalendarDate(now);
    setSelectedDate(now); // actualizar también la fecha seleccionada
  };

  // Cargar eventos al montar el componente
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoadingEvents(true);
        const eventsList = await eventService.getEvents();
        setEvents(eventsList);
      } catch (error) {
        console.error('Error al cargar eventos:', error);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);

  // Función para convertir fecha UTC a local (robusta ante formatos y horas inválidas)
  const utcToLocal = (dateStr: string, timeStr: string) => {
    if (!dateStr) return null;

    try {
      // 1) Parse date (dd/mm/yyyy o yyyy-mm-dd)
      let day: number, month: number, year: number;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split('/').map(n => parseInt(n, 10));
        day = d; month = m; year = y;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
        day = d; month = m; year = y;
      } else {
        // Formato desconocido
        return null;
      }

      if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;

      // 2) Parse time (acepta 24h con o sin AM/PM, o 12h con AM/PM)
      //    Ejemplos válidos: "08:30", "8:30", "08:30 PM", "20:30", "20:30 PM", "28:43 PM"
      let hours = 0;
      let minutes = 0;

      if (timeStr && typeof timeStr === 'string') {
        const m = timeStr.match(/^\s*(\d{1,2}):(\d{2})(?:\s*([AP]M))?\s*$/i);
        if (m) {
          let h = parseInt(m[1], 10);
          let min = parseInt(m[2], 10);
          const period = m[3] ? m[3].toUpperCase() : undefined;

          // Normalizar minutos > 59
          if (min >= 60) {
            h += Math.floor(min / 60);
            min = min % 60;
          }

          // Si hay AM/PM pero la hora es > 12, asumimos 24h y se ignora AM/PM
          if (period && h <= 12) {
            // Conversión 12h
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
          }
          // else: tratamos como 24h tal cual

          // Normalizar horas >= 24 (e.g., "28:43 PM" -> suma días y h%24)
          let dayCarry = 0;
          if (h >= 24) {
            dayCarry = Math.floor(h / 24);
            h = h % 24;
          }

          // Aplicar carry al día
          if (dayCarry) {
            const tmp = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
            tmp.setUTCDate(tmp.getUTCDate() + dayCarry);
            year = tmp.getUTCFullYear();
            month = tmp.getUTCMonth() + 1;
            day = tmp.getUTCDate();
          }

          hours = h;
          minutes = min;
        } else {
          // Si la hora no matchea, asumimos medianoche
          hours = 0;
          minutes = 0;
        }
      }

      // 3) Crear fecha en UTC y devolver Date local (para mostrar en la UI según zona local)
      const utcMs = Date.UTC(year, (month - 1), day, hours, minutes, 0);
      const dLocal = new Date(utcMs);
      if (isNaN(dLocal.getTime())) return null;
      return dLocal;
    } catch {
      return null;
    }
  };

  // Función para obtener eventos de un día específico
  const getEventsForDate = (date: Date) => {
    const dateEvents = events.filter(event => {
      const eventStartDate = utcToLocal(event.startDate, event.startTime);
      const eventEndDate = utcToLocal(event.endDate, event.endTime);

      if (!eventStartDate) return false;

      // Normalizar las fechas a medianoche para comparar solo días
      const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const startDay = new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate());
      const endDay = eventEndDate
        ? new Date(eventEndDate.getFullYear(), eventEndDate.getMonth(), eventEndDate.getDate())
        : startDay;

      // El evento aparece si la fecha está entre el día de inicio y el día de fin (inclusive)
      return checkDate >= startDay && checkDate <= endDay;
    });

    return dateEvents;
  };

  // Reemplaza upcomingEvents por eventos del día seleccionado
  const selectedDayEvents = getEventsForDate(selectedDate).slice(0, 5);

  // Calcular etiqueta del periodo mostrado (4 semanas)
  const periodStart = gridStartDate;
  const periodEnd = new Date(gridStartDate);
  periodEnd.setDate(periodEnd.getDate() + 27);
  const periodLabel =
    periodStart.getMonth() === periodEnd.getMonth() && periodStart.getFullYear() === periodEnd.getFullYear()
      ? `${monthNames[periodStart.getMonth()]} ${periodStart.getFullYear()}`
      : `${monthNames[periodStart.getMonth()]} ${periodStart.getFullYear()} - ${monthNames[periodEnd.getMonth()]} ${periodEnd.getFullYear()}`;

  // Etiqueta para la fecha seleccionada
  // const selectedDateLabel = selectedDate.toLocaleDateString('es-ES', {
  //   weekday: 'long',
  //   day: '2-digit',
  //   month: 'long',
  //   year: 'numeric'
  // });
  const isSelectedToday = selectedDate.toDateString() === today.toDateString();
  const selectedDateHeading = isSelectedToday
    ? 'Eventos de Hoy'
    : `Eventos del ${String(selectedDate.getDate()).padStart(2, '0')} de ${selectedDate.toLocaleDateString('es-ES', { month: 'long' })} de ${selectedDate.getFullYear()}`;

  const { user } = useAuth();
  const showEvaluator = user?.role === 'admin' || user?.role === 'superadmin';

  // Calcular total de participantes sumando los de todos los eventos
  const totalParticipants = events.reduce((sum, event) => sum + (event.participants || 0), 0);

  // Calcular total de evaluaciones (eventos en progreso o completados)
  const totalEvaluations = events.filter(event =>
    event.status === 'En progreso' || event.status === 'Completado'
  ).length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Resumen y análisis de evaluaciones técnicas</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Tarjeta de Eventos */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Eventos</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{events.length}</h3>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-700" />
                </div>
              </div>
            </div>

            {/* Tarjeta de Participantes */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Participantes</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{totalParticipants}</h3>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-700" />
                </div>
              </div>
            </div>

            {/* Tarjeta de Evaluaciones */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Evaluaciones</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{totalEvaluations}</h3>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-700" />
                </div>
              </div>
            </div>
          </div>

          {/* Calendario de Eventos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Calendario */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Calendario de Eventos</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToPreviousPeriod}
                    className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={goToToday}
                    className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Hoy
                  </button>
                  <span className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">
                    {periodLabel}
                  </span>
                  <button
                    onClick={goToNextPeriod}
                    className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Calendario Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Encabezados de días */}
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}

                {/* Días del rango de 4 semanas iniciando en domingo de la semana seleccionada */}
                {Array.from({ length: totalCells }, (_, i) => {
                  const cellDate = new Date(gridStartDate);
                  cellDate.setDate(gridStartDate.getDate() + i);

                  const dayNumber = cellDate.getDate();
                  const isCurrentMonth =
                    cellDate.getMonth() === calendarDate.getMonth() &&
                    cellDate.getFullYear() === calendarDate.getFullYear();

                  const isToday = cellDate.toDateString() === today.toDateString();
                  const isSelected = cellDate.toDateString() === selectedDate.toDateString();
                  const dayEvents = getEventsForDate(cellDate);
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDate(new Date(cellDate))}
                      role="button"
                      tabIndex={0}
                      className={`min-h-20 border rounded-lg p-2 cursor-pointer hover:bg-gray-50
                        ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                        ${(hasEvents && !isToday) ? 'ring-2 ring-blue-200' : ''}
                        ${isToday ? 'border-2 border-red-500 bg-red-50' : 'border-gray-200'}
                        ${isSelected && !isToday ? 'border-2 border-blue-500 bg-blue-50' : ''}`
                      }
                    >
                      <div
                        className={`text-sm font-medium mb-1 ${isToday ? 'text-red-600 font-bold'
                          : isCurrentMonth ? 'text-gray-700'
                            : 'text-gray-400'
                          }`}
                      >
                        {dayNumber}
                      </div>
                      {/* Mostrar eventos también para días fuera del mes actual */}
                      {dayEvents.map((event, idx) => {
                        // Ahora: rango hora inicio - hora fin
                        const startDt = utcToLocal(event.startDate, event.startTime);
                        const endDt = utcToLocal(event.endDate, event.endTime);
                        const startStr = startDt ? startDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                        const endStr = endDt ? endDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                        const rangeStr = endStr ? `${startStr} - ${endStr}` : startStr;

                        const colors = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-amber-100 text-amber-800'];
                        const colorClass = colors[idx % colors.length];

                        return (
                          <div key={event.id} className={`text-xs ${colorClass} rounded px-1.5 py-1 mb-1 truncate`}>
                            {rangeStr} {event.name}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Eventos de Hoy -> ahora dinámico por fecha seleccionada */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedDateHeading}
              </h3>

              <div className="space-y-4">
                {loadingEvents ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Cargando eventos...
                  </div>
                ) : selectedDayEvents.length > 0 ? (
                  selectedDayEvents.map((event) => {
                    // Ahora: rango hora inicio - hora fin
                    const startDt = utcToLocal(event.startDate, event.startTime);
                    const endDt = utcToLocal(event.endDate, event.endTime);
                    const startStr = startDt ? startDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                    const endStr = endDt ? endDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                    const rangeStr = endStr ? `${startStr} - ${endStr}` : startStr;

                    return (
                      <div key={event.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-start">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                            <Calendar className="w-5 h-5 text-blue-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4
                              className="text-sm font-semibold text-gray-900 truncate"
                              title={event.name}
                            >
                              {event.name}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">{rangeStr}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2 min-w-0">
                              <span
                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap shrink-0"
                                title={`${event.participants} participantes`}
                              >
                                {event.participants} participantes
                              </span>
                              {showEvaluator && event.evaluator && (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full max-w-full overflow-hidden whitespace-nowrap truncate"
                                  title={`Evaluador: ${event.evaluator}`}
                                >
                                  Evaluador:&nbsp;{event.evaluator}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No hay eventos programados para esta fecha
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
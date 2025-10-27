import { useState } from 'react';
import { ArrowLeft, Download, Flag, Clock, BarChart2 } from 'lucide-react';
import Sidebar from '../utils/Sidebar';

interface EvaluationDetailsProps {
  onBack?: () => void;
  participantId?: string;
  eventId?: string;
  onNavigate?: (page: string) => void;
}

export default function EvaluationDetails({ onBack, onNavigate }: EvaluationDetailsProps) {
  const [activeTab, setActiveTab] = useState<string>('resumen');

  // Datos simulados para la evaluación
  const evaluationData = {
    id: '2023-A-1458',
    participant: 'Juan Pérez',
    date: '15/05/2023 14:32',
    duration: '58 min',
    riskLevel: 'Alto',
    confidence: '92%',
    recommendation: 'Invalidar',
    alerts: 7,
    riskIndicators: [
      { name: 'Comportamiento sospechoso', value: 85, category: 'Alto' },
      { name: 'Uso de recursos no autorizados', value: 78, category: 'Alto' },
      { name: 'Patrones de mirada', value: 55, category: 'Medio' },
      { name: 'Cambios en expresión facial', value: 40, category: 'Medio' },
      { name: 'Tiempo de respuesta anómalo', value: 25, category: 'Bajo' }
    ],
    detectedAlerts: [
      { time: '14:35:22', type: 'Video', description: 'Persona adicional detectada en cámara', risk: 'Alto' },
      { time: '14:36:18', type: 'Audio', description: 'Conversación detectada', risk: 'Alto' },
      { time: '14:41:05', type: 'Audio', description: 'Conversación detectada', risk: 'Medio' },
      { time: '14:45:37', type: 'Pantalla', description: 'Cambio de ventana detectado', risk: 'Medio' }
    ],
    audioRecords: [
      { id: '1', time: '14:36:18', text: '"...necesito que me ayudes con las respuestas..."', risk: 'Alto', duration: '0:48' },
      { id: '2', time: '14:41:05', text: '"...ya casi termino, espera un momento..."', risk: 'Medio', duration: '1:22' }
    ],
    activityData: [
      { time: '14:32', value: 10 },
      { time: '14:35', value: 30 },
      { time: '14:40', value: 80 },
      { time: '14:45', value: 40 },
      { time: '14:50', value: 35 },
      { time: '14:55', value: 75 },
      { time: '15:00', value: 20 },
      { time: '15:05', value: 40 },
      { time: '15:10', value: 65 },
      { time: '15:15', value: 30 },
      { time: '15:20', value: 15 },
      { time: '15:25', value: 10 },
      { time: '15:30', value: 5 }
    ],
    evidences: [
      { time: '14:35', type: 'video' },
      { time: '14:36', type: 'audio' },
      { time: '14:40', type: 'video' },
      { time: '14:45', type: 'video' },
      { time: '14:50', type: 'video' },
      { time: '15:05', type: 'audio' }
    ]
  };

  // Función para renderizar indicadores de riesgo
  const renderRiskBar = (value: number, category: string) => {
    let bgColor = '';

    switch (category) {
      case 'Alto':
        bgColor = 'bg-red-500';
        break;
      case 'Medio':
        bgColor = 'bg-orange-500';
        break;
      case 'Bajo':
        bgColor = 'bg-green-500';
        break;
      default:
        bgColor = 'bg-gray-500';
    }

    return (
      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
        <div className={`${bgColor} h-2.5 rounded-full`} style={{ width: `${value}%` }}></div>
      </div>
    );
  };

  // Función para renderizar gráfico de actividad
  const renderActivityChart = () => {
    const maxValue = Math.max(...evaluationData.activityData.map(d => d.value));

    // Organizar los datos para las barras por intervalos de 15 minutos
    const timeIntervals = [
      { label: '14:30-14:45', data: evaluationData.activityData.slice(0, 3) },
      { label: '14:45-15:00', data: evaluationData.activityData.slice(3, 7) },
      { label: '15:00-15:15', data: evaluationData.activityData.slice(7, 10) },
      { label: '15:15-15:30', data: evaluationData.activityData.slice(10) }
    ];

    // Calcular el promedio de actividad por intervalo
    const intervalAverages = timeIntervals.map(interval => {
      const sum = interval.data.reduce((acc, point) => acc + point.value, 0);
      return {
        label: interval.label,
        average: Math.round(sum / interval.data.length),
        hasAlert: interval.data.some(point =>
          evaluationData.evidences.some(e => e.time === point.time)
        ),
        alertTypes: interval.data.flatMap(point =>
          evaluationData.evidences
            .filter(e => e.time === point.time)
            .map(e => e.type)
        )
      };
    });

    return (
      <div className="mt-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          {/* Cabecera del gráfico */}
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-medium text-gray-700">Nivel de actividad por período</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <span className="inline-block w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-sm mr-1.5"></span>
                <span className="text-xs text-gray-600">Actividad</span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-3 h-3 bg-red-500 rounded-sm mr-1.5"></span>
                <span className="text-xs text-gray-600">Alerta detectada</span>
              </div>
            </div>
          </div>

          {/* Gráfico de barras */}
          <div className="flex items-end h-60 gap-1 mt-2 relative">
            {/* Líneas horizontales de referencia */}
            {[0, 25, 50, 75, 100].map((level) => (
              <div
                key={level}
                className="absolute w-full h-px bg-gray-100"
                style={{ bottom: `${(level / 100) * 80}%` }}
              >
                <span className="absolute -left-6 -translate-y-1/2 text-xs text-gray-400">
                  {level}
                </span>
              </div>
            ))}

            {/* Barras de actividad */}
            {intervalAverages.map((interval, idx) => {
              // Determinar colores basados en nivel de actividad y alertas
              let barColorClass = "bg-gradient-to-t from-blue-500 to-indigo-600";

              if (interval.average > 70) {
                barColorClass = "bg-gradient-to-t from-red-500 to-orange-400";
              } else if (interval.average > 40) {
                barColorClass = "bg-gradient-to-t from-blue-500 to-indigo-600";
              } else {
                barColorClass = "bg-gradient-to-t from-green-500 to-emerald-400";
              }

              // Calcular altura relativa
              const heightPercentage = (interval.average / maxValue) * 80;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className="relative w-full flex justify-center group">
                    {/* Barra principal */}
                    <div className="w-11/12 relative">
                      <div
                        className={`w-full rounded-t-md ${barColorClass}`}
                        style={{ height: `${heightPercentage}%` }}
                      >
                        {/* Mostrar valor como tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          {interval.average}% de actividad
                        </div>
                      </div>

                      {/* Indicador de alertas */}
                      {interval.hasAlert && (
                        <div className="absolute -top-3 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{interval.alertTypes.length}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Etiqueta del período */}
                  <div className="mt-3 text-xs text-gray-500 font-medium">
                    {interval.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda de eventos con timeline */}
        <div className="mt-5 bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Línea de tiempo de alertas</h4>
          <div className="relative pl-5">
            {/* Línea vertical */}
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {/* Eventos */}
            <div className="space-y-3">
              {evaluationData.evidences.map((evidence, index) => {
                const isVideo = evidence.type === 'video';
                return (
                  <div key={index} className="relative flex items-center">
                    {/* Punto en la línea temporal */}
                    <div className={`absolute -left-3 w-3 h-3 rounded-full border-2 border-white ${isVideo ? 'bg-red-500' : 'bg-blue-500'
                      }`}></div>

                    {/* Contenido del evento */}
                    <div className={`ml-3 px-3 py-2 rounded-md ${isVideo ? 'bg-red-50 text-red-900' : 'bg-blue-50 text-blue-900'
                      } text-xs flex items-center`}>
                      <span className="font-medium">{evidence.time}</span>
                      <span className="mx-1.5">•</span>
                      <span>{isVideo ? 'Alerta de video' : 'Conversación detectada'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Función para obtener clase de color para nivel de riesgo
  const getRiskBadgeClass = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'alto':
        return 'bg-red-100 text-red-800';
      case 'medio':
        return 'bg-orange-100 text-orange-800';
      case 'bajo':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={onBack}
                  className="mr-4 p-1 rounded-full hover:bg-gray-100 transition"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Informe de Evaluación</h1>
              </div>
              <div className="flex items-center">
                <button className="flex items-center px-4 py-2 mr-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </button>
                <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 transition">
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Encabezado de la evaluación */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center">
                  <h2 className="text-xl font-bold text-gray-900 mr-3">{evaluationData.participant}</h2>
                  <div className="inline-flex items-center">
                    <span className="text-gray-600 mr-2">ID:</span>
                    <span className="font-medium">{evaluationData.id}</span>
                  </div>
                  <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${evaluationData.riskLevel === 'Alto' ? 'bg-red-100 text-red-800' : ''}`}>
                    {evaluationData.riskLevel === 'Alto' && '• '}
                    {evaluationData.riskLevel} riesgo
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Evaluación: {evaluationData.date} | Duración: {evaluationData.duration}
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition">
                  Marcar fraudulento
                </button>
                <button className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 transition">
                  Revisión manual
                </button>
              </div>
            </div>
          </div>

          {/* Pestañas */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('resumen')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'resumen'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Resumen
              </button>
              <button
                onClick={() => setActiveTab('evidencias')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'evidencias'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Evidencias
              </button>
              <button
                onClick={() => setActiveTab('linea-tiempo')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'linea-tiempo'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Línea de tiempo
              </button>
              <button
                onClick={() => setActiveTab('detalles')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'detalles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Detalles
              </button>
            </nav>
          </div>

          {/* Contenido de Resumen */}
          {activeTab === 'resumen' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Panel izquierdo - Indicadores de riesgo */}
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Indicadores de riesgo</h3>
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-1"></span>
                      <span className="text-xs text-gray-600">Normal</span>
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-orange-500 rounded-full mr-1"></span>
                      <span className="text-xs text-gray-600">Sospecha</span>
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-red-500 rounded-full mr-1"></span>
                      <span className="text-xs text-gray-600">Alerta</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {evaluationData.riskIndicators.map((indicator, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-700">{indicator.name}</span>
                        <span className="text-sm font-bold text-gray-900">{indicator.value}%</span>
                      </div>
                      {renderRiskBar(indicator.value, indicator.category)}
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-2">Actividad durante la evaluación</h3>
                {renderActivityChart()}
              </div>

              {/* Panel derecho - Resumen */}
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Alertas:</span>
                      <span className="font-medium text-red-600">{evaluationData.alerts}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Nivel de riesgo:</span>
                      <span className="font-medium text-red-600">Alto</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Confianza:</span>
                      <span className="font-medium">{evaluationData.confidence}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Recomendación:</span>
                      <span className="font-medium text-red-600">{evaluationData.recommendation}</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center mb-2">
                      <div className="relative w-full">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="flex h-2 rounded-l-full">
                            <div className="bg-red-500 h-2 rounded-l-full" style={{ width: '70%' }}></div>
                            <div className="bg-orange-500 h-2" style={{ width: '15%' }}></div>
                            <div className="bg-green-500 h-2 rounded-r-full" style={{ width: '15%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600 font-medium">Alto riesgo</span>
                      <span className="text-orange-500 font-medium">Riesgo medio</span>
                      <span className="text-green-600 font-medium">Riesgo bajo</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertas detectadas</h3>
                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                    {evaluationData.detectedAlerts.map((alert, index) => (
                      <div key={index} className="flex items-start p-3 bg-gray-50 rounded-lg">
                        <div className="mr-3">
                          {alert.type === 'Video' ? (
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                              <Flag className="h-4 w-4 text-red-600" />
                            </div>
                          ) : alert.type === 'Audio' ? (
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Flag className="h-4 w-4 text-blue-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <Flag className="h-4 w-4 text-purple-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{alert.type}</span>
                            <span className="text-xs text-gray-500">{alert.time}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                          <div className="mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRiskBadgeClass(alert.risk)}`}>
                              {alert.risk}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Registro de audio</h3>
                    <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      Ver todos (4)
                    </a>
                  </div>
                  <div className="space-y-4 max-h-48 overflow-y-auto pr-1">
                    {evaluationData.audioRecords.map((record) => (
                      <div key={record.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                              <span className="text-xs text-blue-700 font-bold">A</span>
                            </div>
                            <span className="text-sm font-medium">Audio {record.id}</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRiskBadgeClass(record.risk)}`}>
                            {record.risk} riesgo
                          </span>
                        </div>
                        <div className="pl-8">
                          <p className="text-sm text-gray-600 italic mb-1">{record.text}</p>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {record.time}
                            </span>
                            <span>{record.duration}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contenido de Evidencias */}
          {activeTab === 'evidencias' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Evidencias visuales</h3>
                <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                  Ver todas (12)
                </a>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {evaluationData.evidences.map((evidence, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    {evidence.type === 'video' ? (
                      <div className="bg-gray-100 aspect-video flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="bg-gray-100 aspect-video flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </div>
                    )}
                    <div className="px-3 py-2 bg-white">
                      <span className="text-xs text-gray-500 font-medium">{evidence.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Línea de tiempo */}
          {activeTab === 'linea-tiempo' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Línea de tiempo</h3>
              <div className="relative">
                {/* Línea vertical */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                <div className="space-y-8 relative ml-12">
                  {evaluationData.detectedAlerts.map((alert, index) => (
                    <div key={index} className="relative">
                      {/* Punto en la línea */}
                      <div className="absolute -left-12 mt-1.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${alert.risk === 'Alto'
                          ? 'bg-red-100'
                          : alert.risk === 'Medio'
                            ? 'bg-orange-100'
                            : 'bg-green-100'
                          }`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${alert.risk === 'Alto'
                            ? 'bg-red-600'
                            : alert.risk === 'Medio'
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                            }`}></div>
                        </div>
                      </div>

                      <div className="mb-1 flex items-center">
                        <span className="text-sm font-medium text-gray-900">{alert.time}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getRiskBadgeClass(alert.risk)}`}>
                          {alert.risk}
                        </span>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center mb-2">
                          {alert.type === 'Video' ? (
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                              <Flag className="h-4 w-4 text-red-600" />
                            </div>
                          ) : alert.type === 'Audio' ? (
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <Flag className="h-4 w-4 text-blue-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                              <Flag className="h-4 w-4 text-purple-600" />
                            </div>
                          )}
                          <span className="font-medium">{alert.type}</span>
                        </div>
                        <p className="text-gray-700">{alert.description}</p>

                        {alert.type === 'Audio' && (
                          <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                            <div className="flex items-center">
                              <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 mr-3">
                                <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                </svg>
                              </button>
                              <div className="flex-1">
                                <div className="h-2 bg-gray-200 rounded-full">
                                  <div className="h-2 bg-blue-600 rounded-full w-1/3"></div>
                                </div>
                              </div>
                              <span className="ml-3 text-xs text-gray-500">0:48</span>
                            </div>
                          </div>
                        )}

                        {alert.type === 'Video' && (
                          <div className="mt-3 aspect-video bg-gray-100 flex items-center justify-center rounded border border-gray-200">
                            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}

                        {alert.type === 'Pantalla' && (
                          <div className="mt-3 aspect-video bg-gray-100 flex items-center justify-center rounded border border-gray-200">
                            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Detalles */}
          {activeTab === 'detalles' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del participante</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                      <p className="text-sm text-gray-900">{evaluationData.participant}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                      <p className="text-sm text-gray-900">{evaluationData.id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Posición</label>
                      <p className="text-sm text-gray-900">Frontend Developer</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <p className="text-sm text-gray-900">juan.perez@example.com</p>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-4">Información de la evaluación</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                      <p className="text-sm text-gray-900">15/05/2023</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                      <p className="text-sm text-gray-900">14:32</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
                      <p className="text-sm text-gray-900">{evaluationData.duration}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Completado
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de riesgo</label>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Alto
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confianza</label>
                      <p className="text-sm text-gray-900">{evaluationData.confidence}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas detalladas</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <BarChart2 className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-gray-700">Tiempo de respuesta promedio</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">1.8s</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0s</span>
                      <span>1s</span>
                      <span>2s</span>
                      <span>3s+</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <BarChart2 className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-gray-700">Cambios de foco de ventana</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">4</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0</span>
                      <span>5</span>
                      <span>10</span>
                      <span>15+</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <BarChart2 className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-gray-700">Tiempo mirando fuera de pantalla</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">18%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '18%' }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0%</span>
                      <span>10%</span>
                      <span>20%</span>
                      <span>30%+</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <BarChart2 className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-gray-700">Audio ambiente detectado</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">2 veces</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0</span>
                      <span>1</span>
                      <span>3</span>
                      <span>5+</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <BarChart2 className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-gray-700">Coincidencia de respuestas</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">76%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '76%' }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900">Notas del sistema</h4>
                  <ul className="mt-2 space-y-2 text-sm text-gray-600">
                    <li>• Se detectaron comportamientos que indican posible fraude.</li>
                    <li>• La evaluación presenta indicios de ayuda externa.</li>
                    <li>• Se recomienda una revisión manual por parte del equipo evaluador.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
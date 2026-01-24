import { useState } from 'react';
import { User, ArrowRight, Code, CheckCircle, Clock } from 'lucide-react';

interface HomeProps {
  onLogin: () => void;
}

export default function Home({ onLogin }: HomeProps) {
  const [activeSection, setActiveSection] = useState('hero');

  const handleNavigateToSection = (section: string) => {
    setActiveSection(section);
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm fixed w-full z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-blue-600">EvalTech</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <div className="flex space-x-4">
                <button
                  className={`px-3 py-2 text-sm font-medium ${activeSection === 'hero' ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
                  onClick={() => handleNavigateToSection('hero')}
                >
                  Inicio
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium ${activeSection === 'features' ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
                  onClick={() => handleNavigateToSection('features')}
                >
                  Funciones
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium ${activeSection === 'contact' ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
                  onClick={() => handleNavigateToSection('contact')}
                >
                  Contacto
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium ${activeSection === 'download' ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
                  onClick={() => handleNavigateToSection('download')}
                >
                  Descarga
                </button>
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <button
                onClick={onLogin}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <User className="h-4 w-4 mr-2" />
                Iniciar sesión
              </button>
            </div>
            <div className="-mr-2 flex items-center sm:hidden">
              <button
                onClick={() => alert('Menú móvil no implementado')}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <span className="sr-only">Abrir menú</span>
                {/* Hamburger icon */}
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="pt-24 pb-16 sm:pt-32 sm:pb-24 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl md:text-5xl">
              <span className="block">Simplifica el proceso de</span>
              <span className="block text-blue-600">evaluación técnica</span>
            </h1>
            <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-lg md:mt-5 md:text-xl">
              Plataforma integral para gestionar evaluaciones técnicas, participantes y eventos de reclutamiento.
              Optimiza tu proceso de selección con EvalTech.
            </p>
            <div className="mt-8 sm:mt-10 flex justify-center">
              <div className="rounded-md shadow">
                <button
                  onClick={onLogin}
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
                >
                  Comenzar ahora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 sm:mt-0 sm:ml-3">
                <button
                  onClick={() => handleNavigateToSection('features')}
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
                >
                  Conoce más
                </button>
              </div>
            </div>
          </div>
          {/* Hero Image */}
          <div className="mt-12 relative max-w-5xl mx-auto">
            <div className="aspect-w-16 aspect-h-9 rounded-lg shadow-lg overflow-hidden">
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                {/* Simulación de una imagen de dashboard */}
                <div className="w-full h-full bg-white p-6">
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="h-12 bg-blue-100 rounded"></div>
                    <div className="h-12 bg-green-100 rounded"></div>
                    <div className="h-12 bg-purple-100 rounded"></div>
                    <div className="h-12 bg-amber-100 rounded"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="col-span-2 h-40 bg-gray-100 rounded"></div>
                    <div className="h-40 bg-gray-100 rounded"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-32 bg-gray-100 rounded"></div>
                    <div className="h-32 bg-gray-100 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base font-semibold text-blue-600 uppercase tracking-wide">Funcionalidades</h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Todo lo que necesitas para evaluar participantes
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
              Gestiona todo el proceso de evaluación técnica desde un único lugar.
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Feature 1 */}
              <div className="bg-white shadow-md rounded-lg px-6 py-8">
                <div className="p-3 bg-blue-100 inline-block rounded-full">
                  <Code className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Gestión de Evaluaciones</h3>
                <p className="mt-2 text-base text-gray-500">
                  Crea, personaliza y administra evaluaciones técnicas. Configura preguntas, criterios y puntajes.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white shadow-md rounded-lg px-6 py-8">
                <div className="p-3 bg-green-100 inline-block rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Seguimiento de Participantes</h3>
                <p className="mt-2 text-base text-gray-500">
                  Organiza perfiles de participantes, historial de evaluaciones y resultados en un solo lugar.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white shadow-md rounded-lg px-6 py-8">
                <div className="p-3 bg-amber-100 inline-block rounded-full">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Eventos en Tiempo Real</h3>
                <p className="mt-2 text-base text-gray-500">
                  Programa y gestiona sesiones de evaluación, envía invitaciones y monitorea la participación.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 sm:py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-base font-semibold text-blue-600 uppercase tracking-wide">Contacto</h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              ¿Necesitas más información?
            </p>
            <p className="mt-4 text-lg text-gray-500">
              Completa el formulario y nos pondremos en contacto contigo lo antes posible.
            </p>

            <div className="mt-10 bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
              <form className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Nombre
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        id="name"
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="Tu nombre"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <div className="mt-1">
                      <input
                        type="email"
                        id="email"
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="tu@ejemplo.com"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                    Asunto
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="subject"
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Asunto del mensaje"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                    Mensaje
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="message"
                      rows={4}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Escribe tu mensaje aquí"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Enviar mensaje
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-16 sm:py-24 bg-blue-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-base font-semibold text-blue-200 uppercase tracking-wide">Descarga</h2>
            <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              EvalTech para Windows
            </p>
            <p className="mt-4 text-lg text-blue-100">
              Descarga nuestra aplicación para Windows y gestiona tus evaluaciones de manera eficiente.
            </p>

            <div className="mt-10 flex flex-col items-center">
              <div className="flex justify-center space-x-4 mb-6">
                <a
                  href="https://www.dropbox.com/scl/fi/dpdfrw26zacx8v6x84c7i/EvalTech-Monitor-1.0.0-Setup.exe?rlkey=oyf8h4cfulk5a6j9g766cn41b&st=qjsf1tru&dl=1"
                  download="EvalTech-Monitor-Setup.exe"
                  className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
                >
                  <svg className="h-6 w-6 mr-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                  </svg>
                  Descargar para Windows 11/10
                </a>
              </div>
              <div className="mt-2 text-blue-100 text-sm flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Compatible con Windows 10/11</span>
              </div>
              <div className="mt-8 bg-blue-800 rounded-lg p-6 w-full max-w-md">
                <h3 className="text-white font-semibold mb-3">Requisitos del sistema:</h3>
                <ul className="text-blue-100 text-sm space-y-2">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Windows 10 o superior (64 bits)
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Procesador de 2 GHz o superior
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Mínimo 4 GB de RAM
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    500 MB de espacio disponible
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-base text-gray-400 text-center">
            &copy; 2025 EvalTech. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
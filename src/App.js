import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from './supabaseClient'; // Conexión a Supabase

// Corregir icono por defecto de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Función para crear marcadores flotantes modernos según categoría y estado
const crearMarcadorPro = (emoji, estado = 'pendiente') => {
  // Color del borde según estado de gestión
  let colorBorde = '#ef4444'; // Rojo (Pendiente)
  if (estado === 'en_tramite') colorBorde = '#f59e0b'; // Amarillo (En Trámite)
  if (estado === 'solucionado') colorBorde = '#10b981'; // Verde (Solucionado)

  return L.divIcon({
    className: 'custom-clean-marker',
    html: `
      <div style="
        background: #ffffff; 
        border: 3px solid ${colorBorde}; 
        border-radius: 16px; 
        width: 44px; 
        height: 44px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        font-size: 20px; 
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
        position: relative;
        transition: transform 0.2s ease;
      ">
        <span style="transform: translateY(1px);">${emoji}</span>
        <span style="
          position: absolute; 
          top: -4px; 
          right: -4px; 
          width: 12px; 
          height: 12px; 
          background: ${colorBorde}; 
          border-radius: 50%;
          border: 2px solid #ffffff;
        "></span>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -26],
  });
};

const iconosCategorias = {
  basuras: '🗑️',
  vias: '⚠️',
  alumbrado: '💡',
  drenaje: '🌧️',
  ideas: '💡',
};

// Componente auxiliar para recentrar el mapa programáticamente
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// Componente auxiliar para capturar clics en el mapa
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

export default function App() {
  const [reportes, setReportes] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
  const [mapCenter, setMapCenter] = useState([8.755, -75.881]); // Centro de Montería
  const [form, setForm] = useState({
    cat: 'basuras',
    nombre: '',
    descripcion: '',
    foto: '',
  });
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cargandoGPS, setCargandoGPS] = useState(false);

  // Detectar tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cargar datos desde Supabase
  useEffect(() => {
    fetchReportes();
  }, []);

  const fetchReportes = async () => {
    const { data, error } = await supabase
      .from('monte_p')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error al cargar datos de Supabase:', error);
    } else {
      setReportes(data || []);
    }
  };

  // Extraer categoría de la descripción guardada (Formato: [categoria][estado][votos] Texto real)
  const parsearReporte = (item) => {
    const descOriginal = item.Descripción || '';
    // Intentar leer formato avanzado con etiquetas [cat][estado][votos]
    const match = descOriginal.match(/^\[(.*?)\]\[(.*?)\]\[(.*?)\]\s*(.*)$/);
    if (match) {
      return {
        cat: match[1],
        estado: match[2],
        votos: parseInt(match[3]) || 1,
        textoReal: match[4],
      };
    }
    // Compatibilidad con formato anterior [categoria] texto
    const matchLegacy = descOriginal.match(/^\[(.*?)\]\s*(.*)$/);
    if (matchLegacy) {
      return {
        cat: matchLegacy[1],
        estado: 'pendiente',
        votos: 1,
        textoReal: matchLegacy[2],
      };
    }
    return {
      cat: 'basuras',
      estado: 'pendiente',
      votos: 1,
      textoReal: descOriginal,
    };
  };

  // Convertir imagen a Base64
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, foto: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Obtener ubicación GPS actual del dispositivo
  const handleUsarMiUbicacion = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }

    setCargandoGPS(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCargandoGPS(false);
        setMapCenter([lat, lng]);
        setUbicacionSeleccionada({ lat, lng });
        obtenerDireccionInversa(lat, lng, true);
        setIsModalOpen(true);
      },
      (error) => {
        setCargandoGPS(false);
        console.error(error);
        alert(
          'No pudimos obtener tu ubicación GPS. Asegúrate de dar permisos en tu navegador.'
        );
      },
      { enableHighAccuracy: true }
    );
  };

  // Geocodificación inversa gratuita con OpenStreetMap Nominatim
  const obtenerDireccionInversa = async (
    lat,
    lng,
    abrirModalDirecto = false
  ) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      if (data && data.display_name) {
        // Extraer partes clave de la dirección
        const partes = data.display_name.split(',');
        const direccionCorta = partes.slice(0, 2).join(',').trim();
        setForm((prev) => ({
          ...prev,
          nombre: direccionCorta || 'Sector Urbano',
        }));
      }
    } catch (e) {
      console.log('Error obteniendo dirección automática', e);
    }
    if (abrirModalDirecto) {
      setIsModalOpen(true);
    }
  };

  // Manejar clic en el mapa
  const handleMapClick = (latlng) => {
    setUbicacionSeleccionada(latlng);
    setForm({
      cat: 'basuras',
      nombre: 'Punto seleccionado en mapa',
      descripcion: '',
      foto: '',
    });
    obtenerDireccionInversa(latlng.lat, latlng.lng);
    setIsModalOpen(true);
  };

  // Incrementar votos ("A mí también me afecta")
  const handleVotar = async (item) => {
    const datosParsed = parsearReporte(item);
    const nuevosVotos = datosParsed.votos + 1;
    const nuevaDescripcion = `[${datosParsed.cat}][${datosParsed.estado}][${nuevosVotos}] ${datosParsed.textoReal}`;

    const { error } = await supabase
      .from('monte_p')
      .update({ Descripción: nuevaDescripcion })
      .eq('id', item.id);

    if (!error) {
      setReportes(
        reportes.map((r) =>
          r.id === item.id ? { ...r, Descripción: nuevaDescripcion } : r
        )
      );
      alert('¡Gracias! Se ha sumado tu apoyo a este reporte.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Formato estructurado Pro: [categoria][estado][votos] descripcion
    const descripcionEstructurada = `[${form.cat}][pendiente][1] ${form.descripcion}`;

    const nuevoRegistro = {
      lat: ubicacionSeleccionada ? ubicacionSeleccionada.lat : 8.755,
      lng: ubicacionSeleccionada ? ubicacionSeleccionada.lng : -75.881,
      nombre: form.nombre || 'Montería',
      Descripción: descripcionEstructurada,
      ...(form.foto ? { foto: form.foto } : {}),
    };

    const { data, error } = await supabase
      .from('monte_p')
      .insert([nuevoRegistro])
      .select();

    setIsSubmitting(false);

    if (error) {
      console.error('Error al guardar en Supabase:', error);
      alert('Hubo un error al guardar el registro en la base de datos.');
    } else if (data && data.length > 0) {
      setReportes([data[0], ...reportes]);
      setIsModalOpen(false);
      setUbicacionSeleccionada(null);
      setForm({ cat: 'basuras', nombre: '', descripcion: '', foto: '' });
      alert('¡Reporte publicado exitosamente!');
    }
  };

  // Métricas y totales
  const totalReportes = reportes.length;
  const totalSolucionados = reportes.filter(
    (item) => parsearReporte(item).estado === 'solucionado'
  ).length;

  // Filtrar reportes
  const reportesFiltrados = reportes.filter((item) => {
    if (filtro === 'todos') return true;
    const { cat } = parsearReporte(item);
    return cat === filtro;
  });

  return (
    <div
      style={{
        fontFamily:
          "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Institucional Limpio */}
      <header
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #e2e8f0',
          padding: isMobile ? '0.85rem 1rem' : '1rem 2.5rem',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '0.85rem' : '0',
          boxShadow: '0 4px 20px -2px rgba(6, 95, 70, 0.04)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            justifyContent: isMobile ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
              color: '#fff',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '0.95rem',
              boxShadow: '0 4px 12px rgba(6, 95, 70, 0.25)',
            }}
          >
            MP
          </div>
          <div>
            <h1
              style={{
                fontSize: isMobile ? '1rem' : '1.15rem',
                fontWeight: '800',
                color: '#065f46',
                margin: 0,
                lineHeight: '1.2',
              }}
            >
              Montería Puede Más
            </h1>
            <span
              style={{
                fontSize: '0.725rem',
                color: '#64748b',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              Visor Territorial Pro
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
          }}
        >
          <button
            onClick={handleUsarMiUbicacion}
            disabled={cargandoGPS}
            style={{
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: isMobile ? '0.65rem' : '0.65rem 1rem',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(6, 95, 70, 0.08)',
            }}
          >
            <span>📍</span>
            <span>{cargandoGPS ? 'Localizando...' : 'Usar mi GPS'}</span>
          </button>

          <button
            onClick={() => {
              setUbicacionSeleccionada({ lat: 8.755, lng: -75.881 });
              setIsModalOpen(true);
            }}
            style={{
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              color: '#fff',
              border: 'none',
              padding: isMobile ? '0.65rem' : '0.65rem 1.35rem',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '0.875rem',
              boxShadow: '0 4px 14px rgba(6, 95, 70, 0.3)',
            }}
          >
            + Reportar
          </button>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main
        style={{
          maxWidth: '1500px',
          width: '100%',
          margin: '0 auto',
          padding: isMobile ? '1rem' : '1.75rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          flex: 1,
        }}
      >
        {/* Banner Hero & Métricas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr',
            gap: '1.25rem',
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #065f46 0%, #022c22 100%)',
              borderRadius: '20px',
              padding: isMobile ? '1.35rem' : '1.85rem',
              color: '#ffffff',
              boxShadow: '0 12px 30px -8px rgba(6, 95, 70, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: '-20px',
                bottom: '-20px',
                fontSize: '110px',
                opacity: 0.04,
                pointerEvents: 'none',
              }}
            >
              🌱
            </div>
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                padding: '0.3rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.725rem',
                fontWeight: '800',
                marginBottom: '0.85rem',
                width: 'fit-content',
                border: '1px solid rgba(52, 211, 153, 0.3)',
              }}
            >
              OBSERVATORIO CIUDADANO EN VIVO
            </div>
            <h2
              style={{
                fontSize: isMobile ? '1.25rem' : '1.7rem',
                fontWeight: '800',
                lineHeight: '1.3',
                margin: '0 0 0.5rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              Gestión inteligente.{' '}
              <span style={{ color: '#34d399' }}>Participación activa.</span>
            </h2>
            <p
              style={{
                color: '#cbd5e1',
                fontSize: isMobile ? '0.85rem' : '0.925rem',
                margin: 0,
                lineHeight: '1.5',
                maxWidth: '90%',
              }}
            >
              Reporta incidencias, suma apoyos comunitarios y haz seguimiento al
              estado de solución en tiempo real.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.85rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
              }}
            >
              <span style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>
                📍
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: isMobile ? '1.15rem' : '1.4rem',
                  fontWeight: '800',
                  color: '#065f46',
                }}
              >
                {totalReportes}
              </h3>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '0.68rem',
                  color: '#64748b',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                }}
              >
                Reportes Totales
              </p>
            </div>

            <div
              style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
              }}
            >
              <span style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>
                ✅
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: isMobile ? '1.15rem' : '1.4rem',
                  fontWeight: '800',
                  color: '#10b981',
                }}
              >
                {totalSolucionados}
              </h3>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '0.68rem',
                  color: '#64748b',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                }}
              >
                Solucionados
              </p>
            </div>
          </div>
        </div>

        {/* Leyenda de Estados Pro */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: '#475569',
            fontWeight: '700',
            flexWrap: 'wrap',
            background: '#ffffff',
            padding: '0.65rem 1rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <span>Estado del Reporte:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
              }}
            ></span>{' '}
            Pendiente
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#f59e0b',
              }}
            ></span>{' '}
            En Trámite
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
              }}
            ></span>{' '}
            Solucionado
          </span>
        </div>

        {/* Barra de Filtros */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '4px',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: '800',
              color: '#475569',
              marginRight: '0.25rem',
              textTransform: 'uppercase',
            }}
          >
            Filtrar:
          </span>
          {[
            { id: 'todos', label: '🌐 Todos' },
            { id: 'basuras', label: '🗑️ Basuras' },
            { id: 'vias', label: '⚠️ Vías' },
            { id: 'alumbrado', label: '💡 Alumbrado' },
            { id: 'drenaje', label: '🌧️ Drenaje' },
            { id: 'ideas', label: '💡 Ideas' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFiltro(item.id)}
              style={{
                background: filtro === item.id ? '#065f46' : '#ffffff',
                color: filtro === item.id ? '#ffffff' : '#334155',
                border:
                  filtro === item.id
                    ? '1px solid #065f46'
                    : '1px solid #cbd5e1',
                padding: '0.45rem 1rem',
                borderRadius: '24px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Contenedor del Mapa */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            height: isMobile ? '55vh' : '520px',
            position: 'relative',
            boxShadow: '0 20px 35px -10px rgba(15, 23, 42, 0.08)',
          }}
        >
          <MapContainer
            center={[8.755, -75.881]}
            zoom={14}
            style={{ width: '100%', height: '100%', zIndex: 1 }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onMapClick={handleMapClick} />
            <MapController center={mapCenter} />

            {reportesFiltrados.map((item) => {
              const { cat, estado, votos, textoReal } = parsearReporte(item);
              const emojiIcono = iconosCategorias[cat] || '📍';
              const iconoPro = crearMarcadorPro(emojiIcono, estado);

              return (
                <Marker
                  key={item.id}
                  position={[item.lat || 8.755, item.lng || -75.881]}
                  icon={iconoPro}
                >
                  <Popup>
                    <div
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        padding: '4px',
                        maxWidth: '240px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '9px',
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            padding: '2px 6px',
                            borderRadius: '5px',
                            fontWeight: '800',
                            color: '#065f46',
                            textTransform: 'uppercase',
                          }}
                        >
                          {cat}
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            background:
                              estado === 'solucionado' ? '#d1fae5' : '#fef3c7',
                            color:
                              estado === 'solucionado' ? '#065f46' : '#b45309',
                            padding: '2px 6px',
                            borderRadius: '5px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                          }}
                        >
                          {estado.replace('_', ' ')}
                        </span>
                      </div>

                      <h4
                        style={{
                          margin: '4px 0 4px 0',
                          fontSize: '13px',
                          fontWeight: '800',
                          color: '#0f172a',
                        }}
                      >
                        {item.nombre || 'Sin título'}
                      </h4>

                      <p
                        style={{
                          fontSize: '11px',
                          color: '#475569',
                          margin: '0 0 8px 0',
                          lineHeight: '1.4',
                        }}
                      >
                        {textoReal || 'Sin descripción'}
                      </p>

                      {item.foto && (
                        <div
                          style={{
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            marginBottom: '8px',
                          }}
                        >
                          <img
                            src={item.foto}
                            alt="Evidencia"
                            style={{
                              width: '100%',
                              height: '100px',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: '6px',
                          marginTop: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: '#64748b',
                            fontWeight: '700',
                          }}
                        >
                          👥 {votos} afectados
                        </span>
                        <button
                          onClick={() => handleVotar(item)}
                          style={{
                            background: '#065f46',
                            color: '#ffffff',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: '800',
                            cursor: 'pointer',
                          }}
                        >
                          + A mí también
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </main>

      {/* Modal / Diálogo de Reporte Pro */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: isMobile ? 'flex-end' : 'center',
          }}
        >
          <div
            style={{
              background: 'white',
              padding: isMobile ? '1.5rem 1.25rem' : '2.25rem',
              borderRadius: isMobile ? '24px 24px 0 0' : '22px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: '800',
                  color: '#065f46',
                }}
              >
                📍 Registrar Solicitud Ciudadana
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  color: '#475569',
                }}
              >
                ✕
              </button>
            </div>

            <p
              style={{
                fontSize: '0.78rem',
                color: '#475569',
                marginBottom: '1.25rem',
                background: '#f8fafc',
                padding: '0.6rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontWeight: '500',
              }}
            >
              📍 <b>Coordenadas:</b>{' '}
              {ubicacionSeleccionada
                ? `${ubicacionSeleccionada.lat.toFixed(
                    4
                  )}, ${ubicacionSeleccionada.lng.toFixed(4)}`
                : 'N/A'}
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    marginBottom: '0.45rem',
                    color: '#334155',
                    textTransform: 'uppercase',
                  }}
                >
                  Categoría
                </label>
                <select
                  value={form.cat}
                  onChange={(e) => setForm({ ...form, cat: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    backgroundColor: '#fff',
                    color: '#0f172a',
                    fontWeight: '600',
                    outline: 'none',
                  }}
                >
                  <option value="basuras">🗑️ Basuras acumuladas</option>
                  <option value="vias">⚠️ Vías y huecos</option>
                  <option value="alumbrado">💡 Problema de alumbrado</option>
                  <option value="drenaje">🌧️ Inundación / Drenaje</option>
                  <option value="ideas">💡 Propuesta ciudadana</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    marginBottom: '0.45rem',
                    color: '#334155',
                    textTransform: 'uppercase',
                  }}
                >
                  Ubicación / Dirección automática
                </label>
                <input
                  type="text"
                  placeholder="Ej: Calle 27 con Cra 2..."
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    color: '#0f172a',
                    outline: 'none',
                    fontWeight: '500',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    marginBottom: '0.45rem',
                    color: '#334155',
                    textTransform: 'uppercase',
                  }}
                >
                  Descripción del caso
                </label>
                <textarea
                  rows="3"
                  placeholder="Detalles de la situación..."
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    color: '#0f172a',
                    outline: 'none',
                    resize: 'vertical',
                    fontWeight: '500',
                  }}
                ></textarea>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    marginBottom: '0.45rem',
                    color: '#334155',
                    textTransform: 'uppercase',
                  }}
                >
                  Fotografía{' '}
                  <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>
                    (Opcional)
                  </span>
                </label>
                <label
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    textAlign: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>📷</span>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      color: '#065f46',
                    }}
                  >
                    {form.foto ? 'Cambiar foto' : 'Tomar foto o subir archivo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </label>
                {form.foto && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ecfdf5',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: '1px solid #a7f3d0',
                      marginTop: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <img
                        src={form.foto}
                        alt="Miniatura"
                        style={{
                          width: '36px',
                          height: '36px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          color: '#065f46',
                        }}
                      >
                        Foto adjuntada
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, foto: '' })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#b91c1c',
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    color: '#475569',
                    fontSize: '0.875rem',
                    flex: isMobile ? 1 : 'initial',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background:
                      'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.4rem',
                    borderRadius: '12px',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    flex: isMobile ? 1 : 'initial',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Publicando...' : 'Publicar Reporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

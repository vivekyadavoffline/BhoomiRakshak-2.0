import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useRef } from 'react';

const Map = ({ layers, redZones, onZoneSelect }) => {
  const mapRef = useRef(null);

  // Styling functions
  const hazardStyle = { color: '#dc2626', weight: 1, fillOpacity: 0.3 };
  const siteStyle = { color: '#10b981', weight: 2, fillOpacity: 0.5 };
  
  const getHabitationStyle = (feature) => {
    const rz = redZones.find(z => z.habitation_id === feature.properties.id);
    if (!rz) return { color: '#64748b', weight: 1, fillOpacity: 0.1 };
    
    // Color by phase
    if (rz.phase === 'Immediate') return { color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.7 };
    if (rz.phase === 'Short-Term') return { color: '#f97316', weight: 2, fillColor: '#f97316', fillOpacity: 0.6 };
    return { color: '#eab308', weight: 2, fillColor: '#eab308', fillOpacity: 0.5 };
  };

  const onEachHabitation = (feature, layer) => {
    layer.on({
      click: () => {
        const rz = redZones.find(z => z.habitation_id === feature.properties.id);
        if (rz) onZoneSelect(rz);
      }
    });
  };

  return (
    <MapContainer 
      center={[30.316, 78.032]} 
      zoom={11} 
      style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
      ref={mapRef}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      
      {layers.hazards && (
        <GeoJSON 
          data={layers.hazards} 
          style={hazardStyle} 
          key="hazards"
        />
      )}
      
      {layers.sites && (
        <GeoJSON 
          data={layers.sites} 
          style={siteStyle} 
          key="sites"
        />
      )}
      
      {layers.habitations && (
        <GeoJSON 
          data={layers.habitations} 
          style={getHabitationStyle}
          onEachFeature={onEachHabitation}
          key={`habs-${redZones.length}`} // re-render when red zones change
        />
      )}
    </MapContainer>
  );
};

export default Map;

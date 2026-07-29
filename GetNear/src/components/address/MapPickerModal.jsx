import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, isGoogleMapsConfigured } from '../../lib/googleMaps';
import { getCurrentCoordinates, mapGeolocationError } from '../../lib/location';
import { reverseGeocodeAddress, searchAddressSuggestions } from '../../lib/geocoding';
import { IconSearch, IconLocation } from '../ui/Icons';

const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 };

/**
 * Interactive Google Map pin picker with search + reverse geocoding.
 */
export function MapPickerModal({
  open,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocodeTimer = useRef(null);
  const searchTimer = useRef(null);
  const scheduleGeocodeRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState({
    lat: initialLat ?? DEFAULT_CENTER.lat,
    lng: initialLng ?? DEFAULT_CENTER.lng,
  });
  const [preview, setPreview] = useState(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    async function boot() {
      setError('');
      setLoadingMap(true);
      setReady(false);
      setQuery('');
      setSuggestions([]);
      setShowSuggestions(false);

      try {
        if (!isGoogleMapsConfigured()) {
          throw new Error(
            'Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to .env'
          );
        }

        let start = {
          lat: initialLat ?? DEFAULT_CENTER.lat,
          lng: initialLng ?? DEFAULT_CENTER.lng,
        };

        if (initialLat == null || initialLng == null) {
          try {
            const current = await getCurrentCoordinates({
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 60_000,
            });
            start = { lat: current.lat, lng: current.lng };
          } catch {
            // keep default center
          }
        }

        if (cancelled) return;

        const maps = await loadGoogleMaps();
        if (cancelled || !mapNodeRef.current) return;

        const map = new maps.Map(mapNodeRef.current, {
          center: start,
          zoom: 17,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        const marker = new maps.Marker({
          map,
          position: start,
          draggable: true,
          title: 'Delivery location',
        });

        mapRef.current = map;
        markerRef.current = marker;
        setCoords(start);
        setReady(true);

        const scheduleGeocode = (lat, lng) => {
          setCoords({ lat, lng });
          if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
          geocodeTimer.current = setTimeout(() => {
            runGeocode(lat, lng);
          }, 350);
        };
        scheduleGeocodeRef.current = scheduleGeocode;

        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (!pos) return;
          scheduleGeocode(pos.lat(), pos.lng());
        });

        map.addListener('click', (e) => {
          if (!e.latLng) return;
          marker.setPosition(e.latLng);
          scheduleGeocode(e.latLng.lat(), e.latLng.lng());
        });

        await runGeocode(start.lat, start.lng);
      } catch (err) {
        if (!cancelled) {
          const mapped = mapGeolocationError(err);
          setError(err.message || mapped.message);
        }
      } finally {
        if (!cancelled) setLoadingMap(false);
      }
    }

    boot();

    return () => {
      cancelled = true;
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      scheduleGeocodeRef.current = null;
      markerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function runGeocode(lat, lng) {
    setGeocoding(true);
    setError('');
    try {
      const result = await reverseGeocodeAddress(lat, lng);
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setError(err.message || 'Could not reverse geocode this pin');
    } finally {
      setGeocoding(false);
    }
  }

  function movePin(lat, lng, { zoom = 17 } = {}) {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const pos = { lat, lng };
    marker.setPosition(pos);
    map.panTo(pos);
    map.setZoom(zoom);
    setCoords(pos);
  }

  function handleQueryChange(value) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearching(false);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const rows = await searchAddressSuggestions(q, { limit: 6 });
        setSuggestions(rows);
        setShowSuggestions(true);
        setError('');
      } catch (err) {
        setSuggestions([]);
        setError(err.message || 'Could not search locations');
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function handleSelectSuggestion(place) {
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery(place.label || place.formattedAddress || '');
    movePin(place.latitude, place.longitude);
    setPreview(place);
    setCoords({ lat: place.latitude, lng: place.longitude });
    // Refresh readable address bound to this pin
    if (scheduleGeocodeRef.current) {
      scheduleGeocodeRef.current(place.latitude, place.longitude);
    } else {
      runGeocode(place.latitude, place.longitude);
    }
  }

  if (!open) return null;

  return (
    <div className="address-form-overlay address-map-overlay" role="dialog" aria-modal="true">
      <div className="address-map-modal card">
        <div className="address-map-header">
          <h2>Pick location</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="address-map-search">
          <div className="address-map-search-bar">
            <IconSearch size={18} />
            <input
              type="search"
              className="form-input"
              placeholder="Search area, landmark, or address…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length) setShowSuggestions(true);
              }}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          {searching && <p className="muted address-map-search-status">Searching…</p>}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="address-map-suggestions" role="listbox">
              {suggestions.map((place) => (
                <li key={`${place.latitude}-${place.longitude}-${place.label}`}>
                  <button
                    type="button"
                    className="address-map-suggestion"
                    onClick={() => handleSelectSuggestion(place)}
                  >
                    <IconLocation size={16} />
                    <span>{place.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showSuggestions && !searching && query.trim().length >= 3 && suggestions.length === 0 && (
            <p className="muted address-map-search-status">No places found</p>
          )}
        </div>

        {(loadingMap || !ready) && !error && (
          <p className="muted">Loading map…</p>
        )}
        {error && <p className="form-error">{error}</p>}

        <div ref={mapNodeRef} className="address-map-canvas" />

        <div className="address-map-preview">
          <p className="address-map-preview-label">Selected location</p>
          {geocoding && <p className="muted">Looking up address…</p>}
          {!geocoding && preview && (
            <p className="address-line">
              <IconLocation size={16} />
              <span>{preview.formattedAddress}</span>
            </p>
          )}
          {!geocoding && !preview && (
            <p className="muted">Search, tap the map, or drag the pin.</p>
          )}
          <p className="muted address-coords">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </p>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!preview || geocoding}
            onClick={() => onConfirm?.(preview)}
          >
            Confirm location
          </button>
        </div>
      </div>
    </div>
  );
}

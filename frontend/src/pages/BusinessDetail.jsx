import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

export default function BusinessDetail({ businesses, onUpdateImage }) {
  const { id } = useParams();
  const business = businesses.find(b => b._id === id);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  if (!business) {
    return (
      <div className="container">
        <h2 className="section-title">Negocio no encontrado</h2>
        <Link to="/" className="btn btn-outline">Volver al Directorio</Link>
      </div>
    );
  }

  const handleUpdateImage = (e) => {
    e.preventDefault();
    if (newImageUrl.trim()) {
      onUpdateImage(business._id, newImageUrl.trim());
      setIsEditingImage(false);
      setNewImageUrl('');
    }
  };

  const mainImage = business.photoUrls && business.photoUrls[0] 
    ? business.photoUrls[0] 
    : 'https://picsum.photos/1200/400';

  return (
    <div className="business-detail">
      {/* Banner Principal */}
      <div className="detail-banner" style={{ backgroundImage: `url(${mainImage})` }}>
        <div className="banner-overlay">
          <div className="container banner-content">
            <span className="detail-category">{business.categoryId}</span>
            <h1 className="detail-title">{business.name}</h1>
            <div className="detail-meta">
              {business.rating > 0 && <span className="rating">Valoración: {business.rating}/5</span>}
              <span className="address-text">Ubicación: {business.address}</span>
              {business.verified && <span className="verified">Perfil Verificado</span>}
            </div>
            
            <button className="btn btn-edit-image" onClick={() => setIsEditingImage(true)}>
              Actualizar Fotografía
            </button>
          </div>
        </div>
      </div>

      {/* Modal de edición de imagen */}
      {isEditingImage && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Actualizar Fotografía</h3>
              <button className="btn-close" onClick={() => setIsEditingImage(false)}>X</button>
            </div>
            <p>Ingresa la URL de la nueva imagen que deseas mostrar para este negocio.</p>
            <form onSubmit={handleUpdateImage}>
              <input 
                type="url" 
                placeholder="https://ejemplo.com/imagen.jpg" 
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                required
                className="input-field"
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setIsEditingImage(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <div className="container detail-content-layout">
        <main className="detail-main">
          <section className="detail-section">
            <h2 className="section-title">Información de la Empresa</h2>
            <p className="detail-desc">{business.description}</p>
          </section>

          {business.promoText && (
            <section className="detail-section promo-card">
              <h3 className="promo-title">Promoción Especial</h3>
              <p>{business.promoText}</p>
            </section>
          )}

          {business.photoUrls && business.photoUrls.length > 1 && (
            <section className="detail-section">
              <h2 className="section-title">Galería de Imágenes</h2>
              <div className="gallery-grid">
                {business.photoUrls.slice(1).map((url, i) => (
                  <img key={i} src={url} alt={`Galería ${i+1}`} className="gallery-img" />
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="detail-sidebar">
          <div className="info-card">
            <h3>Información de Contacto</h3>
            <ul className="info-list">
              <li>
                <span className="info-label">Teléfono:</span> 
                <span className="info-value">{business.phone}</span>
              </li>
              {business.whatsapp && (
                <li>
                  <span className="info-label">WhatsApp:</span> 
                  <span className="info-value">{business.whatsapp}</span>
                </li>
              )}
              <li>
                <span className="info-label">Zona:</span> 
                <span className="info-value">{business.zone}</span>
              </li>
            </ul>
          </div>
          
          <div className="info-card">
            <h3>Horario de Atención</h3>
            <ul className="info-list">
              {business.hours && Object.entries(business.hours).map(([day, hours]) => (
                <li key={day} className="hours-row">
                  <span className="info-label">{day}:</span> 
                  <span className="info-value">{hours}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import categoriesData from '../data/localmarket.categories.json';

export default function Home({ businesses }) {
  const [activeCategory, setActiveCategory] = useState(null);

  const filteredBusinesses = activeCategory
    ? businesses.filter((b) => b.categoryId === activeCategory)
    : businesses;

  return (
    <main className="container">
      {/* Pestañas (Tabs) de Categorías */}
      <section className="categories-section">
        <nav className="tabs-nav">
          <button 
            className={`tab-item ${!activeCategory ? 'active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            Todos
          </button>
          {categoriesData.map(cat => (
            <button 
              key={cat._id}
              className={`tab-item ${activeCategory === cat._id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat._id)}
            >
              {cat.name}
            </button>
          ))}
        </nav>
      </section>

      {/* Listado de Negocios */}
      <section className="businesses-section">
        <div className="section-header">
          <h2 className="section-title">
            {activeCategory 
              ? `Categoría: ${categoriesData.find(c => c._id === activeCategory)?.name}`
              : 'Directorio de Negocios'}
          </h2>
          <span className="results-count">{filteredBusinesses.length} resultados</span>
        </div>
        
        {filteredBusinesses.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron negocios en esta categoría.</p>
          </div>
        ) : (
          <div className="grid">
            {filteredBusinesses.map(business => (
              <Link to={`/business/${business._id}`} key={business._id} className="card-link">
                <div className="card">
                  <img 
                    src={business.photoUrls && business.photoUrls[0] ? business.photoUrls[0] : 'https://picsum.photos/600/400'} 
                    alt={business.name} 
                    className="card-image"
                    loading="lazy"
                  />
                  <div className="card-content">
                    <div className="card-header">
                      <h3 className="card-title">{business.name}</h3>
                      {business.rating > 0 && (
                        <span className="card-rating">★ {business.rating}</span>
                      )}
                    </div>
                    
                    <div className="card-category">
                      {categoriesData.find(c => c._id === business.categoryId)?.name || business.categoryId}
                    </div>
                    
                    <p className="card-desc">
                      {business.description.length > 90 
                        ? business.description.substring(0, 90) + '...' 
                        : business.description}
                    </p>
                    
                    <div className="card-footer">
                      <span className="card-zone">{business.zone || business.address.split(',').pop()}</span>
                      {business.verified && (
                        <span className="badge-verified">Verificado</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

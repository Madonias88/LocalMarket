import { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import BusinessDetail from './pages/BusinessDetail';
import initialBusinesses from './data/localmarket.businesses.json';

function App() {
  const [businesses, setBusinesses] = useState(initialBusinesses);

  // Función para actualizar la imagen de un negocio (simulando guardado en DB)
  const updateBusinessImage = (businessId, newImageUrl) => {
    setBusinesses(prev => prev.map(b => {
      if (b._id === businessId) {
        // Reemplazamos la primera imagen o la agregamos si no tiene
        const newPhotoUrls = [...(b.photoUrls || [])];
        if (newPhotoUrls.length > 0) {
          newPhotoUrls[0] = newImageUrl;
        } else {
          newPhotoUrls.push(newImageUrl);
        }
        return { ...b, photoUrls: newPhotoUrls };
      }
      return b;
    }));
  };

  return (
    <>
      <header className="header">
        <div className="container">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <h1>LocalMarket</h1>
          </Link>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>
            Descubre los mejores negocios en tu comunidad.
          </p>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home businesses={businesses} />} />
        <Route 
          path="/business/:id" 
          element={<BusinessDetail businesses={businesses} onUpdateImage={updateBusinessImage} />} 
        />
      </Routes>
    </>
  );
}

export default App;

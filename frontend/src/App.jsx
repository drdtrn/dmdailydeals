import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Medical/Home';
import Footer from "./components/Footer/Footer"
import NavBar from './components/Header/NavBar';
import ProductPage from './pages/Products/product-page';
import AllProducts from './pages/allProducts/AllProducts';
import AboutMe from './pages/aboutUs/aboutUs';
import CategoryFilteredProducts from './pages/category/CategoryFilteredProducts';


function App() {

  const ExternalRedirect = ({ to }) => {
    useEffect(() => {
      window.location.replace(to);
    }, [to]);
  
    return <div>Redirecting to admin panel...</div>;
  };

  return (
    <div className="flex flex-col bg-[#FBFBFB] min-h-screen">
      
        <NavBar />

        <Routes>
          {/* Home page */}
          <Route path="/" element={<Home />} />
          
          {/* Product detail page */}
          <Route 
            path="/products/:productId" 
            element={<ProductPage />} 
          />

          <Route path="/allProducts" element={<AllProducts />} />

          <Route 
            path="/category/:productCategory" 
            element={<CategoryFilteredProducts />} 
          />

          <Route path="/aboutUs" element={<AboutMe/>} />

          <Route path="/admin" element={<ExternalRedirect to={`http://${import.meta.env.VITE_CURRENT_IP}:3000/controlPanel`} />} />

          <Route path="*" element={<h1>404 Not Found</h1>} />

        </Routes>

        <Footer />
      
  </div>
  )
}

export default App;
import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Medical/Home';
import Footer from "./components/Footer/Footer"
import NavBar from './components/Header/NavBar';
// import "./App.css";
import ProductPage from './pages/Products/product-page';
import AllProducts from './pages/allProducts/AllProducts';
import AboutMe from './pages/aboutUs/aboutUs';

function App() {

  const ExternalRedirect = ({ to }) => {
    useEffect(() => {
      // Replace instead of push to history
      window.location.replace(to);
    }, [to]);
  
    return <div>Redirecting to admin panel...</div>;
  };

  return (
    <div className="App bg-[#FBFADA]">
      
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

          <Route path="/aboutUs" element={<AboutMe/>} />

          <Route path="/admin" element={<ExternalRedirect to="http://192.168.178.172:3000/controlPanel" />} />

          <Route path="*" element={<h1>404 Not Found</h1>} />

        </Routes>
        
        <hr style={{width:"75%", border:"solid rgba(56, 54, 54, 0.462) 2px", boxShadow:"3px 3px 5px rgba(56, 54, 54, 0.19)", alignSelf:"center"}}/>
      
        <Footer />
      
      
    
  </div>
  )
}

export default App;
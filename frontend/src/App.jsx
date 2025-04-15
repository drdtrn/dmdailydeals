import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Medical/Home';
import Footer from "./components/Footer/Footer"
import NavBar from './components/Header/NavBar';
import "./components/Medical/medical.css";
import ProductPage from './pages/Products/product-page';

function App() {
  return (
    <div className="App">
      <div className='main-div'>
        <NavBar />

        <Routes>
          {/* Home page */}
          <Route path="/" element={<Home />} />
          
          {/* Product detail page */}
          <Route 
            path="/products/:productId" 
            element={<ProductPage />} 
          />
          <Route path="*" element={<h1>404 Not Found</h1>} />
        </Routes>

        <hr style={{width:"75%", border:"solid rgba(56, 54, 54, 0.462) 2px", boxShadow:"3px 3px 5px rgba(56, 54, 54, 0.19)", alignSelf:"center"}}/>
      
        <Footer />
      
      </div>
    
  </div>
  )
}

export default App;
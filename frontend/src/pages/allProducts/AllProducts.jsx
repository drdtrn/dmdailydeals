import React from 'react';
import useGetAllProducts from '../../hooks/useGetAllProducts';
import ProductCard from '../../components/ProductCard';
import { Link } from 'react-router-dom';
import './all-products.css';

function AllProducts () {

    const { products } = useGetAllProducts();

    return (
      <div className="products-grid-container">
        <h2 className="products-title">Our Products</h2>
        
        <div className="products-grid">
        {products.map(
          product => (
            <Link 
            to={`/products/${product.id}`} 
            key={product.id}
            >
              <ProductCard
              key={product.id}
              link={product.link}
              title={product.title}
              image={`http://localhost:3000/uploads/${product.filename}`}
              brand="DMDailyDeals"
              description={product.description}
            />
          </Link>
          )
        )
          }
        </div>
      </div>
    );
  };

export default AllProducts;
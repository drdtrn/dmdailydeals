import React from 'react';
import useGetProductsByCategory from '../../hooks/useGetProductsByCategory';
import ProductCard from '../../components/ProductCard';
import { Link, useParams } from 'react-router-dom';

function CategoryFilteredProducts () {

    const { productCategory } = useParams();

    const { products, loading, error } = useGetProductsByCategory(productCategory);

    if (loading) {
        return <div className="container">Loading product details...</div>;
    }

    if (error) {
        return <div className="container text-danger">Error: {error}</div>;
    }

    if (!products) {
        return <div className="container">Product not found</div>;
    }

    return (
      <div className="bg-rock-200 w-full pt-15 lg:pt-5 flex-row justify-center items-center flex-grow mt-[5rem] lg:mt[0rem]">
        <h2 className="text-center font-mono font-extrabold text-[2rem] lg:text-[2.2rem]">{productCategory.toUpperCase()}</h2>
        
        <div className="grid w-full grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
              image={`http://${import.meta.env.VITE_CURRENT_IP}:3000/uploads/${product.filename}`}
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

export default CategoryFilteredProducts;
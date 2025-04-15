import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './product-page.css'

function ProductPage() {
    // This is used to get the :productId parameter from the URL
    const { productId } = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
  
    useEffect(() => {
      const fetchProduct = async () => {
        try {
          // Axios automatically parses JSON
          const response = await axios.get(`http://localhost:3000/api/products/${productId}`);
          
          // Axios wraps the response in a "data" property
          setProduct(response.data);
        } catch (err) {
          // Axios error handling
          if (err.response) {
            // Server responded with 4xx/5xx status
            setError(err.response.data.message || 'Product not found');
          } else {
            // Network errors (no response)
            setError('Network error. Please try again.');
          }
        } finally {
          setLoading(false);
        }
      };
  
      fetchProduct();
    }, [productId]);

    if (loading) {
        return <div className="container">Loading product details...</div>;
    }

    if (error) {
        return <div className="container text-danger">Error: {error}</div>;
    }

    if (!product) {
        return <div className="container">Product not found</div>;
    }
    console.log(product[0])

    return (
        <div className="container cards">
            <h1 className="pb-2 border-bottom">{product[0].title}</h1>
            <img src={`http://localhost:3000/uploads/${product[0].filename}`} className="card-img-top" alt={product[0].alttext}/>
            <p className="lead mb-4">{product[0].description}</p>
            <a href="#" className="btn btn-primary mt-auto">Buy on Amazon</a>
        </div>
    )
}

export default ProductPage;
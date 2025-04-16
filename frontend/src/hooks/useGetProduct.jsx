import { useState, useEffect } from "react";
import axios from 'axios';

function useGetProduct(parameter) {

        const [product, setProduct] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);

        useEffect(() => {
            const fetchProduct = async () => {
              try {
                // Axios automatically parses JSON
                const response = await axios.get(`http://localhost:3000/api/products/${parameter}`);
                
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
          }, [parameter]);

          return { product, loading, error }; 
}

export default useGetProduct;
import { useState, useEffect } from "react";
import axios from 'axios';


function useGetAllProducts() {

    const [products, setProducts] = useState([]);
  
    useEffect(() => {
      const fetchProducts = async () => {
        try {
          const response = await axios.get(`http://${import.meta.env.VITE_CURRENT_IP}:3000/api/products`);
          setProducts(response.data);
        } catch (error) {
          console.error('Error fetching products:', error);
        }
      };
      
      fetchProducts();
    }, []);

    return { products };
};

export default useGetAllProducts;
import { useState, useEffect } from "react";
import axios from "axios";

function useGetCategories(category) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(
          `http://${
            import.meta.env.VITE_CURRENT_IP
          }:3000/api/product-category/${category}`
        );
        setCategories(response.data);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchCategories();
  }, [category]);
  return { categories };
}

export default useGetCategories;

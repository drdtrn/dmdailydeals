import { useState, useEffect, useRef, useMemo } from "react";
import useGetAllProducts from "../hooks/useGetAllProducts";
import { Link } from "react-router-dom";

function SearchBar() {
  const { products } = useGetAllProducts();

  const allProducts = useMemo(() => {
    return products.map((product) => product); // Create stable reference
  }, [products]);
  // const allProducts = products.map((product) => product);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCategories, setFilteredCategories] = useState(allProducts);
  const dropdownRef = useRef(null);

  // Filter categories based on search term
  useEffect(() => {
    const filtered = allProducts.filter((product) =>
      product.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCategories(filtered);
  }, [searchTerm, allProducts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function makeStateTrue() {
    setIsOpen(true);
  }

  const handleCategoryClick = (category) => {
    console.log(`Selected: ${category}`);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <>
      <div className="w-64 xl:w-150" ref={dropdownRef}>
        <div className="w-full mt-1 bg-white border rounded-md shadow-lg">
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onClick={makeStateTrue}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border-b focus:outline-none"
          />
          {isOpen && (
            <ul className="max-h-50 overflow-auto">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((product, index) => (
                  <Link
                    key={index}
                    onClick={() => handleCategoryClick(product)}
                    to={`/products/${product.id}`}
                  >
                    <li className="px-4 py-2 hover:bg-blue-100 cursor-pointer">
                      <div className="flex flex-row h-10">
                        <img
                          src={`http://${
                            import.meta.env.VITE_CURRENT_IP
                          }:3000/uploads/${product.filename}`}
                          alt=""
                          className="h-10 mx-2 place-self-center rounded-md"
                        />
                        <div>
                          <h1>{product.title}</h1>
                          <p className="text-gray-400 truncate">
                            {product.description}
                          </p>
                        </div>
                      </div>
                    </li>
                  </Link>
                ))
              ) : (
                <li className="px-4 py-2 text-gray-500">No categories found</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export default SearchBar;

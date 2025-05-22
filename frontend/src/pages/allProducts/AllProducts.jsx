import { useState } from "react";
import useGetAllProducts from "../../hooks/useGetAllProducts";
import ProductCard from "../../components/ProductCard";
import { Link } from "react-router-dom";
import ProductModal from "../Products/ProductModal";

function AllProducts() {
  const { products } = useGetAllProducts();

  const [isOpen, setIsOpen] = useState(false);
  const [prodId, setProdId] = useState(1);

  return (
    <div className="bg-rock-200 w-full flex-row justify-center items-center mt-[5rem] flex-grow">
      <h2 className="text-center font-mono font-extrabold text-[2rem] lg:text-[2.2rem] p-15 lg:p-5">
        Our Products
      </h2>

      <div className="grid w-full grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        {products.map((product) => (
          <div key={product.id} className="flex flex-col">
            <Link to={`/products/${product.id}`} key={product.id}>
              <ProductCard
                link={product.link}
                title={product.title}
                image={`http://${
                  import.meta.env.VITE_CURRENT_IP
                }:3000/uploads/${product.filename}`}
                brand="DMDailyDeals"
                description={product.description}
              />
            </Link>
            {/* The lines below enable opening a modal when the button is clicked */}
            <button
              onClick={() => {
                setIsOpen(true), setProdId(product.id);
              }}
              className="m-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 place-self-center"
            >
              View more info
            </button>
          </div>
        ))}
        <ProductModal
          open={isOpen}
          onClose={() => setIsOpen(false)}
          productId={prodId}
        />
      </div>
    </div>
  );
}

export default AllProducts;

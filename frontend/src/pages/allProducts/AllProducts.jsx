import useGetAllProducts from "../../hooks/useGetAllProducts";
import ProductCard from "../../components/ProductCard";
import { Link } from "react-router-dom";
// import './all-products.css';

function AllProducts() {
  const { products } = useGetAllProducts();

  return (
    <div className="bg-rock-200 w-full flex-row justify-center items-center mt-[5rem] flex-grow">
      <h2 className="text-center font-mono font-extrabold text-[2rem] lg:text-[2.2rem] p-15 lg:p-5">
        Our Products
      </h2>

      <div className="grid w-full grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        {products.map((product) => (
          <Link to={`/products/${product.id}`} key={product.id}>
            <ProductCard
              key={product.id}
              link={product.link}
              title={product.title}
              image={`http://${import.meta.env.VITE_CURRENT_IP}:3000/uploads/${
                product.filename
              }`}
              brand="DMDailyDeals"
              description={product.description}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AllProducts;

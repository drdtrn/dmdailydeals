import useGetProduct from "../../hooks/useGetProduct";
import { useParams } from "react-router-dom";

function ProductPage() {
  // This is used to get the :productId parameter from the URL
  const { productId } = useParams();

  const { product, loading, error } = useGetProduct(productId);

  if (loading) {
    return <div className="container">Loading product details...</div>;
  }

  if (error) {
    return <div className="container text-danger">Error: {error}</div>;
  }

  if (!product) {
    return <div className="container">Product not found</div>;
  }

  return (
    <div className="flex flex-col items-center pt-[15vh] gap-10 flex-grow mb-5">
      <h1 className="text-black p-5 text-[min(7vw,50px)]">
        {product[0].title}
      </h1>
      <div className="flex flex-col items-center lg:flex-row-reverse gap-20">
        <img
          src={`http://${import.meta.env.VITE_CURRENT_IP}:3000/uploads/${
            product[0].filename
          }`}
          className="w-[100%] lg:w-[60%]"
          alt={product[0].alttext}
        />
        <p className="lead mb-4 text-[min(5vw,20px)] self-end text-end">
          {product[0].description}
        </p>
      </div>
      <a
        href="#"
        className="inline-block px-[3vw] py-[1vh] bg-[#436850] text-white font-bold text-[min(1.5vw,20px)] leading-tight uppercase 
                rounded shadow-md hover:bg-[#43766C] hover:shadow-lg focus:bg-[#12372A] focus:shadow-lg focus:outline-none 
                focus:ring-0 active:bg-[#12372A] active:shadow-lg transition duration-150 ease-in-out"
      >
        Buy on Amazon
      </a>
    </div>
  );
}

export default ProductPage;

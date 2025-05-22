import useGetProduct from "../../hooks/useGetProduct";
import "./product-page.css";

function ProductModal({ open, onClose, productId }) {
  const { product } = useGetProduct(productId);

  if (!open) return null;

  return (
    <div className="modal-open modal-overlay active">
      <div className="modal-content p-6 w-auto max-w-lg">
        <span className="modal-close text-2xl font-bold" onClick={onClose}>
          ×
        </span>

        <img
          src={`http://${import.meta.env.VITE_CURRENT_IP}:3000/uploads/${
            product[0].filename
          }`}
          className="w-auto h-[48vh] object-cover rounded-md mb-4"
          alt={product[0].alttext}
        />
        <h2 className="text-2xl font-bold mb-2">{product[0].title}</h2>
        <p className="text-lg text-gray-700 mb-2">$99.99</p>
        <p className="text-gray-600">{product[0].description}</p>
        <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Add to Cart
        </button>
      </div>
    </div>
  );
}

export default ProductModal;

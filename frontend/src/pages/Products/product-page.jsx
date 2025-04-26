import React from 'react';
import useGetProduct from '../../hooks/useGetProduct';
import { useParams } from 'react-router-dom';
import './product-page.css';


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
        <div className="container cards">
            <h1 className="pb-2 border-bottom">{product[0].title}</h1>
            <img src={`http://${import.meta.env.VITE_CURRENT_IP}:3000/uploads/${product[0].filename}`} className="card-img-top" alt={product[0].alttext}/>
            <p className="lead mb-4">{product[0].description}</p>
            <a href="#" className="btn btn-primary mt-auto">Buy on Amazon</a>
        </div>
    )
}

export default ProductPage;
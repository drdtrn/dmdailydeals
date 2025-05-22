import React from "react";
import "./ProductCard.css";

function ProductCard({
  link,
  image,
  title,
  brand,
  description,
  formattedPrice,
}) {
  return (
    <div className="product-card w-[20rem]" href={link}>
      <img className="product-card__image" src={image} />
      <h1 className="product-card__title text-[min(3vw,25px)]">{title}</h1>
      <p className="product-card__brand">{brand}</p>
      <p className="product-card__description text-[min(3vw,20px)]">
        {description}
      </p>
      <p className="product-card__price">{formattedPrice}</p>
    </div>
  );
}

export default ProductCard;

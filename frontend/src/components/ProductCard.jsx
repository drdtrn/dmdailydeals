import React from "react";
import "./ProductCard.css"

function ProductCard(props) {

    return (
        <div className="product-card w-[20rem]" href={props.link}>
        <img className="product-card__image" src={props.image} />
        <h1 className="product-card__title text-[min(3vw,25px)]">{props.title}</h1>
        <p className="product-card__brand">{props.brand}</p>
        <p className="product-card__description text-[min(3vw,20px)]">{props.description}</p>
        <p className="product-card__price">{props.formattedPrice}</p>
      </div>
    )
}

export default ProductCard;
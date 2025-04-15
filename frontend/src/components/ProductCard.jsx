import React, {useState} from "react";
import "./ProductCard.css"

function ProductCard(props) {

    return (
        <div className="product-card" href={props.link}>
        <img className="product-card__image" src={props.image} />
        <h1 className="product-card__title">{props.title}</h1>
        <p className="product-card__brand">{props.brand}</p>
        <p className="product-card__description">{props.description}</p>
        <p className="product-card__price">{props.formattedPrice}</p>
      </div>
    )
}

export default ProductCard;
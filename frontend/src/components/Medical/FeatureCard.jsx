import React, {useState} from "react";
import "../ProductCard.css"

function FeatureCard(props) {
    return (
        <div className="product-card" style={{backgroundColor: "inherit", boxShadow: "none"}}>
          <img className="svg" src={props.svg} alt="svg tick" />
          <p className="product-card__brand">{props.title}</p>
          <p className="product-card__description">{props.description}</p>
        </div>
    )
}

export default FeatureCard;
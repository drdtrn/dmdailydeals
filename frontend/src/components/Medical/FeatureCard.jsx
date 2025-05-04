import React from "react";
import "../ProductCard.css"

function FeatureCard(props) {
    return (
        <div className="product-card w-auto lg:w-[25vw]" style={{backgroundColor: "inherit", boxShadow: "none"}}>
          <img className="svg" src={props.svg} alt="svg tick" />
          <p className="product-card__brand text-[2rem] lg:text-[1.5rem]">{props.title}</p>
          <p className="product-card__description text-[1.5rem] lg:text-[1rem]">{props.description}</p>
        </div>
    )
}

export default FeatureCard;
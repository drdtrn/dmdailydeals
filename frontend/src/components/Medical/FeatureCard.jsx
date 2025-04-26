import React, {useState} from "react";
import "../ProductCard.css"

function FeatureCard(props) {
    return (
        <div className="product-card w-auto lg:w-[25vw]" style={{backgroundColor: "inherit", boxShadow: "none"}}>
          <img className="svg" src={props.svg} alt="svg tick" />
          <p className="product-card__brand text-[min(4vw,30px)]">{props.title}</p>
          <p className="product-card__description text-[min(3vw,25px)]">{props.description}</p>
        </div>
    )
}

export default FeatureCard;
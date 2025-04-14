import React, { useState } from 'react';
import "./Hero.css"

function Hero(props) {
    const backgroundStyle = {
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        backgroundImage:
        `linear-gradient(rgba(0, 0, 0, 0.5),rgba(0, 0, 0, 0.5)), url(${
          props.imgSrc
        })`,
        backgroundColor: "transparent",
      };
    
      return (
        <section className="hero" style={backgroundStyle}>
          <div className="hero-body">      
            <div>
              <h1 style={{ color: "white" }}>Hello and Welcome</h1>
              <h2 style={{ color: "white" }}>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</h2>
            </div>
          </div>
        </section>
      );
}

export default Hero;
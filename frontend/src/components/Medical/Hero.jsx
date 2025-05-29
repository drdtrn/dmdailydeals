import React from "react";
// import "./Hero.css"

function Hero(props) {
  const backgroundStyle = {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5),rgba(0, 0, 0, 0.5)), url(${props.imgSrc})`,
  };

  return (
    <section
      className="flex justify-center items-center w-full bg-fixed bg-cover bg-center bg-no-repeat bg-transparent h-[60vh] lg:h-[95vh]"
      style={backgroundStyle}
    >
      <div>
        <div className="flex flex-col items-center m-10 lg:m-20">
          <h1 className="text-[min(10vw,70px)] text-white text-shadow-xs">
            Hello and Welcome
          </h1>
          <h2
            className="text-[min(3vw,25px)] text-center text-shadow-xs"
            style={{ color: "#FBFADA" }}
          >
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur.
          </h2>
        </div>
      </div>
    </section>
  );
}

export default Hero;

import React, { useState } from "react";
import useGetAllProducts from "../../hooks/useGetAllProducts";
import { Link } from "react-router-dom";
import HeroImg from "../../assets/heroimg.jpg";
import Hero from "./Hero";
import ProductCard from "../ProductCard";
import "./medical.css";
import svg from "../../assets/ticksvg.svg";
import FeatureCard from "./FeatureCard";
import ShowCategories from "./ShowCategories";

function Home() {
  const { products } = useGetAllProducts();

  const uniqueCatList = [
    ...new Set(products.map((product) => product.category)),
  ];

  const [indeks, setIndeks] = useState(0);
  const maxIndeks = uniqueCatList.length;

  function increaseIndex() {
    if (indeks < maxIndeks - 1) {
      setIndeks(indeks + 1);
    } else {
      setIndeks(0);
    }
  }

  function decreaseIndex() {
    if (indeks >= maxIndeks - 1) {
      setIndeks(indeks - 1);
    } else {
      setIndeks(maxIndeks - 1);
    }
  }

  return (
    <div className="flex flex-col flex-grow items-center">
      <Hero imgSrc={HeroImg} />

      <div className="flex flex-col">
        <h2 className="text-[min(7vw,50px)] border-b-2 border-t-2 border-solid border-gray-400 text-shadow-xs">
          Why US ?
        </h2>
        <div className="flex m-10 gap-10 p-10 flex-wrap">
          <FeatureCard
            svg={svg}
            title="Title"
            description="Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo."
          />
          <FeatureCard
            svg={svg}
            title="Title"
            description="Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt."
          />
          <FeatureCard
            svg={svg}
            title="Title"
            description="Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. "
          />
        </div>
      </div>

      <hr
        style={{
          width: "90%",
          border: "solid rgba(56, 54, 54, 0.12) 1px",
          boxShadow: "3px 3px 5px rgba(77, 75, 75, 0.22)",
          alignSelf: "center",
          margin: "20px",
        }}
      />

      <div className="flex flex-row gap-2 w-[90%] align-center justify-center">
        <button
          className="mr-auto inline-block px-[1.5vw] py-[1vh] bg-transparent text-black font-bold text-[min(1.5vw,20px)] leading-tight uppercase 
                rounded shadow-md hover:bg-[#3b3b3b16] hover:shadow-lg focus:bg-transparent focus:shadow-lg focus:outline-none 
                focus:ring-0 active:bg-[#3b3b3b16] active:shadow-lg transition duration-150 ease-in-out text-[min(3vw,40px)]"
          onClick={decreaseIndex}
        >
          {"<"}
        </button>

        <ShowCategories category={uniqueCatList[indeks]} />

        <button
          className="ml-auto inline-block px-[1.5vw] py-[1vh] bg-transparent text-black font-bold text-[min(1.5vw,20px)] leading-tight uppercase 
                rounded shadow-md hover:bg-[#3b3b3b16] hover:shadow-lg focus:bg-transparent focus:shadow-lg focus:outline-none 
                focus:ring-0 active:bg-[#3b3b3b16] active:shadow-lg transition duration-150 ease-in-out text-[min(3vw,40px)]"
          onClick={increaseIndex}
        >
          {">"}
        </button>
      </div>

      <hr
        style={{
          width: "90%",
          border: "solid rgba(56, 54, 54, 0.12) 1px",
          boxShadow: "3px 3px 5px rgba(77, 75, 75, 0.22)",
          alignSelf: "center",
          margin: "20px",
        }}
      />

      <div className="flex flex-col items-center">
        <h2 className="text-[min(7vw,50px)] border-b-2 border-t-2 border-solid border-gray-400 text-shadow-xs">
          Products{" "}
        </h2>
        <div className="flex gap-10 p-10">
          {products.slice(0, 3).map((product, index) => (
            <Link
              to={`/products/${product.id}`}
              key={product.id}
              className={index === 2 ? "hidden lg:block" : ""}
            >
              <ProductCard
                key={product.id}
                link={product.link}
                title={product.title}
                image={`http://${
                  import.meta.env.VITE_CURRENT_IP
                }:3000/uploads/${product.filename}`}
                brand="DMDailyDeals"
                description={product.description}
              />
            </Link>
          ))}
        </div>

        <Link
          className="inline-block px-[3vw] py-[1vh] bg-[#436850] text-white font-bold text-[min(1.5vw,20px)] leading-tight uppercase 
                rounded shadow-md hover:bg-[#43766C] hover:shadow-lg focus:bg-[#12372A] focus:shadow-lg focus:outline-none 
                focus:ring-0 active:bg-[#12372A] active:shadow-lg transition duration-150 ease-in-out mb-5"
          to={`/allProducts`}
          key={2}
        >
          See more...
        </Link>
      </div>

      {/* <hr style={{width:"80%", border:"solid rgba(56, 54, 54, 0.12) 1px", boxShadow:"3px 3px 5px rgba(77, 75, 75, 0.22)", alignSelf:"center", margin:"20px"}}/> */}
    </div>
  );
}

export default Home;

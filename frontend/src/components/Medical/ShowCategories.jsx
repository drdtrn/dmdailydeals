import React from "react";
import useGetCategories from "../../hooks/useGetCategories";
import { Link } from "react-router-dom";

function ShowCategories({ category }) {
  const { categories } = useGetCategories(category);

  return (
    <div className="flex flex-col gap-2 mx-9 my-5 min-h-auto items-center">
      <h1 className="place-self-center mb-5 text-[min(4.5vw,50px)] border-b-2 border-t-2 border-solid border-gray-400 text-shadow-xs">
        Category
      </h1>
      <div className="flex flex-row h-auto border-hidden rounded-md shadow-md w-[65vw] lg:w-[50vw] place-content-center bg-[#F8FAE5] p-[20px]">
        <div className="px-5 border-r-2 border-r-[rgb(52,52,52,0.4)]">
          <h1 className="font-bold text-shadow-xs text-[min(3vw,25px)]">
            {category?.toUpperCase()}
          </h1>
        </div>
        <div className="px-5">
          {categories.slice(0, 3).map((product) => (
            <div className="py-1" key={product.id}>
              <h1 className="text-[min(3vw,20px)]">{product.title}</h1>
            </div>
          ))}
        </div>
      </div>

      <Link to={`category/${category}`} className="place-self-center">
        <h1 className="pt-[20px] text-gray-600 underline decoration-[rgb(52,52,52,0.5)] decoration-2 decoration-double text-[min(3vw,20px)]">
          See more...
        </h1>
      </Link>
    </div>
  );
}

export default ShowCategories;

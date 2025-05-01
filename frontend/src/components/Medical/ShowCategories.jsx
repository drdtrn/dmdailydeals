import React from "react";
import useGetCategories from "../../hooks/useGetCategories";

function ShowCategories({category}) {
    
    const categoryElements = useGetCategories(category).categories;

    return(        
            <div className="flex flex-row gap-2 mx-9 my-5">
                <div className="px-5">
                    <h1 className="font-bold">{category.toUpperCase()}</h1>
                </div>
                <div>
                {categoryElements.slice(0, 3).map((product) => (
                    <div className="" 
                    key={product.id}>
                        <h1>{product.title}</h1>
                    </div>
                ))}
                </div>
            </div>        
    )
}

export default ShowCategories;
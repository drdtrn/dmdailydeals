import React, {useState} from "react";
import Menu from "./menu";
import "./NavBar.css";

function NavBar() {
    
    // const clicked = false;

    // const [condition, setCondition] = useState(false);
      
    // function onIconClick() {
    //     setCondition(true);
    // }
    return(
        <header className="header">
            <a href="/" className="logo">Logo</a>

            <nav className="navbar">
                <a href="">Home</a>
                <a href="">Portfolio</a>
                <a href="">All Products</a>
                <a href="">About Us</a>
            </nav>
        </header>
    )
}

export default NavBar;
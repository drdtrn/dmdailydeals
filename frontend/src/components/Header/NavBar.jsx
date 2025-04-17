import React, {useState} from "react";
import { Link } from 'react-router-dom';
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
                <Link to={`/`} key={0} >Home</Link>
                <a href="">Portfolio</a>
                <Link to={`/allProducts`} key={2} >All Products</Link>
                <Link to={`/aboutUs`} key={3} >About Us</Link>
            </nav>
        </header>
    )
}

export default NavBar;
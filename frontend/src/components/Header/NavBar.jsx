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
        <header className="header bg-[#12372A]">
            <a href="/" className="logo">Logo</a>

            <nav className="navbar">
                <Link to={`/`} key={0} >Home</Link>
                <Link to={`/admin`} key={1} >Admin</Link>
                <Link to={`/allProducts`} key={2} >All Products</Link>
                <Link to={`/aboutUs`} key={3} >About Us</Link>
            </nav>
        </header>
    )
}

export default NavBar;
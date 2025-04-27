import React, {useState} from "react";
import { Link } from 'react-router-dom';
// import Menu from "./menu";
import "./NavBar.css";

function NavBar() {
    
    return(
        <header className="header flex justify-between items-center bg-[#12372A] fixed z-100 top-0 left-0 w-[100%] px-[10%] py-[2vh] lg:py-[2.5vh]">
            <a href="/" className="logo text-[3rem]">Logo</a>
            
            <nav className="navbar">
                <Link className="text-[2rem] lg:text-[1.5rem]" to={`/`} key={0} >Home</Link>
                <Link className="text-[2rem] lg:text-[1.5rem]" to={`/admin`} key={1} >Admin</Link>
                <Link className="text-[2rem] lg:text-[1.5rem]" to={`/allProducts`} key={2} >All Products</Link>
                <Link className="text-[2rem] lg:text-[1.5rem]" to={`/aboutUs`} key={3} >About Us</Link>
            </nav>
        </header>
    )
}

export default NavBar;